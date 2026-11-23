import { useState } from "react";
import { BarChart3, Crosshair } from "lucide-react";
import { AuditorShell } from "@/components/auditor/auditor-shell";
import { SniperAnalitico } from "@/components/auditor/sniper-analitico";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import Analista from "@/pages/Analista";

/**
 * Área de Análises do Qualy Auditor.
 * - Sniper Analítico: acha os FVs com todas as etapas em N/A (leitura local).
 * - Analista BI: motor de importação/indicadores já existente, sem alteração.
 * A tabela qualyflow_analyses permanece intacta.
 */
export default function AuditorAnalises() {
  const [aba, setAba] = useState<"sniper" | "analista">("sniper");

  return (
    <AuditorShell>
      <div
        className={cn(
          "inline-flex items-center gap-1 rounded-xl border border-glass-border/60 bg-glass/40 p-1",
          "backdrop-blur",
        )}
      >
        <Button
          type="button"
          size="sm"
          variant={aba === "sniper" ? "default" : "ghost"}
          className="h-8 gap-1.5 rounded-lg px-3 text-[11px]"
          onClick={() => setAba("sniper")}
        >
          <Crosshair className="h-3.5 w-3.5" />
          Sniper Analítico
        </Button>
        <Button
          type="button"
          size="sm"
          variant={aba === "analista" ? "default" : "ghost"}
          className="h-8 gap-1.5 rounded-lg px-3 text-[11px]"
          onClick={() => setAba("analista")}
        >
          <BarChart3 className="h-3.5 w-3.5" />
          Analista BI
        </Button>
      </div>

      {aba === "sniper" ? <SniperAnalitico /> : <Analista />}
    </AuditorShell>
  );
}
