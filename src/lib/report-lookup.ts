import { supabase } from "@/integrations/supabase/client";
import { invalidateAuditorCache } from "@/lib/auditor";

/**
 * Ponte entre o Emissor e o Qualy Auditor.
 * - preenche o cabeçalho a partir de FV (FAC), OS, protocolo SGZ ou nome do arquivo;
 * - junta TODAS as fontes (tratativas e PDFs importados) para não devolver
 *   campo vazio quando o dado existe em outro registro da mesma FV/OS;
 * - após emitir uma devolutiva Pós 60, move a FV/OS para a célula escolhida.
 */

export interface ReportLookup {
  fac: string;
  os: string;
  address: string;
  serviceType: string;
  locality: string;
  contractor: string;
  /** Data da fiscalização (dd/mm/aaaa) — vem da "data de avaliação". */
  date: string;
  /** Protocolo: o SGZ quando existir; senão a própria FV, que é o mesmo número. */
  protocol: string;
  situacao: string;
  prazo: string;
  origem: string;
}

function valor(fields: Record<string, string> | null | undefined, chave: string): string {
  return (fields?.[chave] ?? "").trim();
}

function limparData(valorBruto: string): string {
  const bruto = valorBruto.trim();
  if (!bruto) {
    return "";
  }
  const br = /^(\d{1,2})[/.-](\d{1,2})[/.-](\d{2,4})$/.exec(bruto);
  if (br) {
    return `${br[1].padStart(2, "0")}/${br[2].padStart(2, "0")}/${br[3].length === 2 ? `20${br[3]}` : br[3]}`;
  }
  const iso = /^(\d{4})-(\d{2})-(\d{2})/.exec(bruto);
  if (iso) {
    return `${iso[3]}/${iso[2]}/${iso[1]}`;
  }
  return bruto;
}

/** Busca o cabeçalho combinando tratativas e PDFs, pelo número informado. */
export async function lookupReportData(term: string): Promise<ReportLookup | null> {
  const bruto = term.trim();
  if (bruto.length < 4) {
    return null;
  }

  const apenasDigitos = bruto.replace(/\D/g, "");
  const termos = Array.from(new Set([bruto, apenasDigitos].filter((valorTermo) => valorTermo.length >= 4)));

  const colunasCaso = "id, document_id, fac, os, address, municipality, locality, service_type, contractor";

  const consultas: PromiseLike<{ data: unknown }>[] = [];
  for (const valorTermo of termos) {
    consultas.push(
      supabase.from("qa_cases").select(colunasCaso).eq("fac", valorTermo).limit(1).then((r) => ({ data: r.data?.[0] ?? null })),
      supabase.from("qa_cases").select(colunasCaso).eq("os", valorTermo).limit(1).then((r) => ({ data: r.data?.[0] ?? null })),
      supabase.from("qa_documents").select("fields").eq("fields->>fac", valorTermo).limit(2).then((r) => ({ data: r.data ?? [] })),
      supabase.from("qa_documents").select("fields").eq("fields->>os", valorTermo).limit(2).then((r) => ({ data: r.data ?? [] })),
      supabase.from("qa_documents").select("fields").eq("fields->>protocoloSgz", valorTermo).limit(2).then((r) => ({ data: r.data ?? [] })),
    );
  }

  const resultados = await Promise.all(consultas);

  const encontrado: ReportLookup = {
    fac: "",
    os: "",
    address: "",
    serviceType: "",
    locality: "",
    contractor: "",
    date: "",
    protocol: "",
    situacao: "",
    prazo: "",
    origem: "",
  };

  const preencher = (campo: keyof ReportLookup, novo: string) => {
    if (!encontrado[campo] && novo.trim()) {
      encontrado[campo] = novo.trim();
    }
  };

  // 1) Tratativas (têm endereço, serviço, município e contratada)
  for (const item of resultados) {
    const linha = item.data as
      | {
          fac: string | null;
          os: string | null;
          address: string | null;
          municipality: string | null;
          locality: string | null;
          service_type: string | null;
          contractor: string | null;
        }
      | null
      | undefined;

    if (!linha || typeof linha !== "object" || !("os" in linha)) {
      continue;
    }

    preencher("fac", linha.fac ?? "");
    preencher("os", linha.os ?? "");
    preencher("address", linha.address ?? "");
    preencher("serviceType", linha.service_type ?? "");
    preencher("locality", linha.locality ?? "");
    preencher("contractor", linha.contractor ?? "");
  }

  // 2) PDFs importados (têm data de avaliação, endereço e protocolo SGZ)
  for (const item of resultados) {
    const lista = item.data as { fields?: Record<string, string> }[] | undefined;
    if (!Array.isArray(lista)) {
      continue;
    }
    for (const doc of lista) {
      const campos = doc?.fields ?? {};
      preencher("fac", valor(campos, "fac"));
      preencher("os", valor(campos, "os"));
      preencher("address", valor(campos, "endereco"));
      preencher("serviceType", valor(campos, "servico"));
      preencher("locality", valor(campos, "polo") || valor(campos, "localidade"));
      preencher("contractor", valor(campos, "contratada"));
      preencher("date", limparData(valor(campos, "data")));
      preencher("protocol", valor(campos, "protocoloSgz"));
      preencher("situacao", valor(campos, "situacao"));
      preencher("prazo", valor(campos, "prazo"));
      preencher("origem", valor(campos, "origemDemanda"));
    }
  }

  // 3) Ainda sem endereço ou data? Procura em outra tratativa da mesma FV/OS.
  if ((!encontrado.address || !encontrado.date) && (encontrado.fac || encontrado.os)) {
    const filtros = [encontrado.fac, encontrado.os].filter(Boolean);
    for (const filtro of filtros) {
      const { data } = await supabase
        .from("qa_cases")
        .select("fac, os, address, service_type, locality, contractor")
        .or(`fac.eq.${filtro},os.eq.${filtro}`)
        .not("address", "is", null)
        .limit(5);

      for (const linha of data ?? []) {
        preencher("fac", linha.fac ?? "");
        preencher("os", linha.os ?? "");
        preencher("address", linha.address ?? "");
        preencher("serviceType", linha.service_type ?? "");
      }
    }
  }

  if (!encontrado.fac && !encontrado.os && !encontrado.address && !encontrado.date) {
    return null;
  }

  // Protocolo é a própria FV quando não há protocolo SGZ.
  if (!encontrado.protocol) {
    encontrado.protocol = encontrado.fac;
  }

  return encontrado;
}

/** Depois de emitir uma devolutiva Pós 60, a tratativa vai para a célula escolhida. */
export async function syncReportToAuditor(input: {
  templateId: string;
  fac: string;
  os: string;
  address: string;
  serviceType: string;
  /** Célula escolhida pelo operador (Respondidos ou RPA). */
  cell?: "respondidos" | "rpa";
}): Promise<void> {
  if (!input.templateId.startsWith("pos_60")) {
    return;
  }

  const fac = input.fac.trim();
  const os = input.os.trim();
  if (!fac && !os) {
    return;
  }

  const agora = new Date().toISOString();
  const destino = input.cell ?? "respondidos";
  const situacao = destino === "rpa" ? "em_analise" : "resposta_enviada";

  // Sem endereço no relatório? Tenta o cadastro antes de criar a tratativa.
  let endereco = input.address.trim();
  let servico = input.serviceType.trim();
  if (!endereco) {
    try {
      const achado = await lookupReportData(fac || os);
      if (achado) {
        endereco = endereco || achado.address;
        servico = servico || achado.serviceType;
      }
    } catch {
      /* segue sem endereço */
    }
  }

  const { data: existente } = await supabase
    .from("qa_cases")
    .select("id")
    .eq("fac", fac)
    .eq("os", os)
    .maybeSingle();

  if (existente?.id) {
    await supabase
      .from("qa_cases")
      .update({
        cell: destino,
        analysis_status: situacao,
        updated_at: agora,
      })
      .eq("id", existente.id);

    await supabase.from("qa_case_events").insert({
      case_id: existente.id,
      event_type: destino === "rpa" ? "encaminhado_rpa" : "resposta_enviada",
      payload: { origem: "emissor" } as never,
    });
  } else {
    const { data: criado } = await supabase
      .from("qa_cases")
      .insert({
        fac,
        os,
        address: endereco,
        service_type: servico,
        cell: destino,
        analysis_status: situacao,
        outcome: "pendente",
      })
      .select("id")
      .single();

    if (criado?.id) {
      await supabase.from("qa_case_events").insert({
        case_id: criado.id,
        event_type: destino === "rpa" ? "encaminhado_rpa" : "resposta_enviada",
        payload: { origem: "emissor" } as never,
      });
    }
  }

  invalidateAuditorCache();
}
