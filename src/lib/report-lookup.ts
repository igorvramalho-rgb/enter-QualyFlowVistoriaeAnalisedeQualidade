import { supabase } from "@/integrations/supabase/client";
import { invalidateAuditorCache } from "@/lib/auditor";

/**
 * Ponte entre o Emissor e o Qualy Auditor.
 * - preenche OS/endereço a partir do que já existe no banco (FV, OS ou protocolo SGZ);
 * - após emitir uma devolutiva Pós 60, move a FV/OS para a célula "Respondidos".
 */

export interface ReportLookup {
  fac: string;
  os: string;
  address: string;
  serviceType: string;
  locality: string;
  contractor: string;
}

function valor(fields: Record<string, string> | null | undefined, chave: string): string {
  return (fields?.[chave] ?? "").trim();
}

/** Busca os dados já conhecidos para a FV, OS ou protocolo SGZ informado. */
export async function lookupReportData(term: string): Promise<ReportLookup | null> {
  const bruto = term.trim();
  if (bruto.length < 4) {
    return null;
  }
  const apenasDigitos = bruto.replace(/\D/g, "");
  const termos = Array.from(new Set([bruto, apenasDigitos].filter((valor) => valor.length >= 4)));

  const colunas = "id, document_id, fac, os, address, service_type, locality, contractor";

  // Consultas simples por coluna (sem filtro composto), em paralelo.
  const consultas: PromiseLike<{ data: unknown }>[] = [];
  for (const valor of termos) {
    consultas.push(
      supabase.from("qa_cases").select(colunas).eq("fac", valor).limit(1).then((r) => ({ data: r.data?.[0] ?? null })),
      supabase.from("qa_cases").select(colunas).eq("os", valor).limit(1).then((r) => ({ data: r.data?.[0] ?? null })),
    );
  }

  const resultados = await Promise.all(consultas);
  const caso = resultados.find((item) => item.data)?.data as
    | {
        document_id: string | null;
        fac: string | null;
        os: string | null;
        address: string | null;
        service_type: string | null;
        locality: string | null;
        contractor: string | null;
      }
    | undefined;

  if (caso) {
    let address = caso.address ?? "";
    const campos: Record<string, string> = {};

    if (caso.document_id) {
      const { data: doc } = await supabase
        .from("qa_documents")
        .select("fields")
        .eq("id", caso.document_id)
        .maybeSingle();
      Object.assign(campos, (doc?.fields as Record<string, string>) ?? {});
    }

    if (!address) {
      address = valor(campos, "endereco");
    }

    return {
      fac: (caso.fac ?? "").trim(),
      os: (caso.os ?? "").trim(),
      address,
      serviceType: (caso.service_type ?? "").trim() || valor(campos, "servico"),
      locality: (caso.locality ?? "").trim() || valor(campos, "polo") || valor(campos, "localidade"),
      contractor: (caso.contractor ?? "").trim() || valor(campos, "contratada"),
    };
  }

  // Sem tratativa: procura no PDF importado (FAC, OS ou protocolo SGZ).
  const docs: PromiseLike<{ data: unknown }>[] = [];
  for (const valor of termos) {
    docs.push(
      supabase.from("qa_documents").select("fields").eq("fields->>fac", valor).limit(1).then((r) => ({ data: r.data?.[0] ?? null })),
      supabase.from("qa_documents").select("fields").eq("fields->>os", valor).limit(1).then((r) => ({ data: r.data?.[0] ?? null })),
      supabase.from("qa_documents").select("fields").eq("fields->>protocoloSgz", valor).limit(1).then((r) => ({ data: r.data?.[0] ?? null })),
    );
  }

  const achados = await Promise.all(docs);
  for (const item of achados) {
    const fields = (item.data as { fields?: Record<string, string> } | null)?.fields;
    if (!fields) {
      continue;
    }
    const resultado: ReportLookup = {
      fac: valor(fields, "fac"),
      os: valor(fields, "os"),
      address: valor(fields, "endereco"),
      serviceType: valor(fields, "servico"),
      locality: valor(fields, "polo") || valor(fields, "localidade"),
      contractor: valor(fields, "contratada"),
    };
    if (resultado.os || resultado.address || resultado.fac) {
      return resultado;
    }
  }

  return null;
}

/** Depois de emitir uma devolutiva Pós 60, a tratativa vai para "Respondidos". */
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
        address: input.address.trim(),
        service_type: input.serviceType.trim(),
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
