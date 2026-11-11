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
  const value = term.trim();
  if (value.length < 4) {
    return null;
  }

  const { data: casos } = await supabase
    .from("qa_cases")
    .select("id, document_id, fac, os, address, service_type, locality, contractor")
    .or(`fac.eq.${value},os.eq.${value}`)
    .limit(1);

  const caso = casos?.[0];
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

  const consultas = await Promise.all([
    supabase.from("qa_documents").select("fields").eq("fields->>fac", value).limit(1),
    supabase.from("qa_documents").select("fields").eq("fields->>protocoloSgz", value).limit(1),
    supabase.from("qa_documents").select("fields").eq("fields->>os", value).limit(1),
  ]);

  for (const resultado of consultas) {
    const fields = resultado.data?.[0]?.fields as Record<string, string> | undefined;
    if (!fields) {
      continue;
    }
    const achado: ReportLookup = {
      fac: valor(fields, "fac"),
      os: valor(fields, "os"),
      address: valor(fields, "endereco"),
      serviceType: valor(fields, "servico"),
      locality: valor(fields, "polo") || valor(fields, "localidade"),
      contractor: valor(fields, "contratada"),
    };
    if (achado.os || achado.address || achado.fac) {
      return achado;
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
        cell: "respondidos",
        analysis_status: "resposta_enviada",
        updated_at: agora,
      })
      .eq("id", existente.id);

    await supabase.from("qa_case_events").insert({
      case_id: existente.id,
      event_type: "resposta_enviada",
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
        cell: "respondidos",
        analysis_status: "resposta_enviada",
        outcome: "pendente",
      })
      .select("id")
      .single();

    if (criado?.id) {
      await supabase.from("qa_case_events").insert({
        case_id: criado.id,
        event_type: "resposta_enviada",
        payload: { origem: "emissor" } as never,
      });
    }
  }

  invalidateAuditorCache();
}
