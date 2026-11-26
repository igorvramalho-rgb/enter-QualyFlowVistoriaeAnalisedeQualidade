import { useCallback, useEffect, useMemo, useState } from "react";
import { Loader2, RefreshCw, Search, Trash2, TriangleAlert, X } from "lucide-react";
import { AuditorShell } from "@/components/auditor/auditor-shell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { toast } from "@/components/ui/sonner";
import { CELLS, type CellKey } from "@/lib/auditor";
import {
  buildDuplicatesWorkbook,
  deleteDuplicateUploads,
  fetchDuplicateUploads,
  type DuplicateUpload,
} from "@/lib/auditor-duplicates";

const dataBR = (valor: string | null) => {
  if (!valor) {
    return "—";
  }
  const data = new Date(valor);
  return Number.isNaN(data.getTime()) ? "—" : data.toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" });
};

/**
 * Aba Duplicados: registro das importações que tentaram entrar com um PDF que
 * já existia. Serve para localizar os repetidos no computador e limpar o log —
 * documentos, FV/OS e células não são alterados aqui.
 */
export default function AuditorDuplicados() {
  const [linhas, setLinhas] = useState<DuplicateUpload[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState("");
  const [busca, setBusca] = useState("");
  const [selecionados, setSelecionados] = useState<Set<string>>(new Set());
  const [apagarOpen, setApagarOpen] = useState(false);
  const [apagarTudo, setApagarTudo] = useState(false);
  const [busy, setBusy] = useState(false);
  const [exportando, setExportando] = useState(false);

  const carregar = useCallback(async () => {
    setCarregando(true);
    try {
      setLinhas(await fetchDuplicateUploads());
      setErro("");
    } catch (problema) {
      setErro(problema instanceof Error ? problema.message : "Falha ao carregar os duplicados");
    } finally {
      setCarregando(false);
    }
  }, []);

  useEffect(() => {
    void carregar();
  }, [carregar]);

  const filtradas = useMemo(() => {
    const termo = busca.trim().toLowerCase();
    if (!termo) {
      return linhas;
    }
    return linhas.filter((linha) =>
      [linha.fileName, linha.existingFileName, linha.fac, linha.os]
        .join(" ")
        .toLowerCase()
        .includes(termo),
    );
  }, [linhas, busca]);

  const alternar = (id: string) => {
    setSelecionados((anteriores) => {
      const proximo = new Set(anteriores);
      if (proximo.has(id)) {
        proximo.delete(id);
      } else {
        proximo.add(id);
      }
      return proximo;
    });
  };

  const exportar = async () => {
    const alvos = filtradas.length > 0 ? filtradas : linhas;
    if (alvos.length === 0) {
      toast.info("Nada para exportar", { description: "Nenhum duplicado registrado." });
      return;
    }

    setExportando(true);
    try {
      const blob = await buildDuplicatesWorkbook(alvos);
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `duplicados-${new Date().toISOString().slice(0, 10)}.xlsx`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      setTimeout(() => URL.revokeObjectURL(url), 5000);
      toast.success("Excel gerado", { description: `${alvos.length} arquivo(s) duplicado(s) na planilha.` });
    } catch (problema) {
      toast.error("Falha ao gerar o Excel", {
        description: problema instanceof Error ? problema.message : undefined,
      });
    } finally {
      setExportando(false);
    }
  };

  const apagar = async () => {
    const alvos = apagarTudo ? undefined : Array.from(selecionados);
    if (!apagarTudo && (!alvos || alvos.length === 0)) {
      return;
    }

    setBusy(true);
    try {
      const removidos = await deleteDuplicateUploads(alvos);
      toast.success("Registro de duplicados limpo", {
        description: `${removidos} registro(s) apagado(s). Documentos e células não foram alterados.`,
      });
      setSelecionados(new Set());
      setApagarOpen(false);
      setApagarTudo(false);
      await carregar();
    } catch (problema) {
      toast.error("Falha ao apagar", { description: problema instanceof Error ? problema.message : undefined });
    } finally {
      setBusy(false);
    }
  };

  const rotuloCelula = (valor: string) => (valor ? CELLS[valor as CellKey]?.label ?? valor : "—");
  const todosVisiveisMarcados = filtradas.length > 0 && filtradas.every((linha) => selecionados.has(linha.id));

  return (
    <AuditorShell>
      <Card className="p-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-sm font-semibold text-foreground">Duplicados</h1>
            <p className="mt-0.5 max-w-2xl text-[11px] leading-relaxed text-muted-foreground">
              Tentativas de importar um PDF que já existia na base. Elas não entram na célula e não criam documento
              novo. Use o Excel para achar os repetidos no computador e, se quiser, limpe este registro — FV/OS,
              documentos e células permanecem intactos.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button type="button" variant="glass" size="sm" onClick={() => void carregar()} disabled={carregando}>
              {carregando ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
              Atualizar
            </Button>
            <Button type="button" variant="glow" size="sm" onClick={() => void exportar()} disabled={exportando || linhas.length === 0}>
              {exportando ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
              Baixar Excel
            </Button>
            <Button
              type="button"
              variant="destructive"
              size="sm"
              onClick={() => {
                setApagarTudo(false);
                setApagarOpen(true);
              }}
              disabled={selecionados.size === 0 || busy}
            >
              <Trash2 className="h-3.5 w-3.5" />
              Apagar selecionados
            </Button>
            <Button
              type="button"
              variant="glass"
              size="sm"
              className="text-destructive"
              onClick={() => {
                setApagarTudo(true);
                setApagarOpen(true);
              }}
              disabled={linhas.length === 0 || busy}
            >
              <X className="h-3.5 w-3.5" />
              Limpar registro
            </Button>
          </div>
        </div>

        <div className="mt-3 flex flex-wrap items-center gap-2">
          <div className="relative">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={busca}
              onChange={(event) => setBusca(event.target.value)}
              placeholder="Buscar arquivo, FV ou OS"
              className="h-8 w-[260px] pl-8 text-xs"
            />
          </div>
          <Badge variant="secondary" className="auditor-num">
            {linhas.length} duplicado(s)
          </Badge>
          {selecionados.size > 0 && (
            <Badge variant="secondary" className="auditor-num">
              {selecionados.size} selecionado(s)
            </Badge>
          )}
          {filtradas.length > 0 && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-7 px-2 text-[11px]"
              onClick={() =>
                setSelecionados(
                  todosVisiveisMarcados ? new Set() : new Set(filtradas.map((linha) => linha.id)),
                )
              }
            >
              {todosVisiveisMarcados ? "Desmarcar todos" : "Selecionar todos"}
            </Button>
          )}
        </div>
      </Card>

      {erro && (
        <Card className="border-destructive/40 bg-destructive/5 p-3 text-xs text-foreground">
          Não foi possível carregar os duplicados: {erro}
        </Card>
      )}

      <Card className="overflow-hidden p-0">
        {carregando ? (
          <div className="flex items-center justify-center gap-2 px-4 py-12 text-xs text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            Carregando duplicados...
          </div>
        ) : filtradas.length === 0 ? (
          <p className="px-4 py-10 text-center text-xs text-muted-foreground">
            Nenhum duplicado registrado. Arquivos repetidos passam a aparecer aqui na próxima importação.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-[11px]">
              <thead className="border-b border-glass-border/60 bg-glass/40 text-[10px] uppercase tracking-wide text-muted-foreground">
                <tr>
                  <th className="w-8 px-3 py-2" />
                  <th className="px-3 py-2">Arquivo duplicado</th>
                  <th className="px-3 py-2">Já existia como</th>
                  <th className="px-3 py-2">Origem</th>
                  <th className="px-3 py-2">FV / OS</th>
                  <th className="px-3 py-2">Célula do existente</th>
                  <th className="px-3 py-2">Detectado em</th>
                </tr>
              </thead>
              <tbody>
                {filtradas.map((linha) => (
                  <tr key={linha.id} className="border-b border-glass-border/40 last:border-0">
                    <td className="px-3 py-2">
                      <Checkbox
                        checked={selecionados.has(linha.id)}
                        onCheckedChange={() => alternar(linha.id)}
                        aria-label={`Selecionar ${linha.fileName}`}
                      />
                    </td>
                    <td className="max-w-[280px] truncate px-3 py-2 font-medium text-foreground" title={linha.fileName}>
                      {linha.fileName}
                    </td>
                    <td className="max-w-[280px] truncate px-3 py-2 text-muted-foreground" title={linha.existingFileName}>
                      {linha.existingFileName || "—"}
                    </td>
                    <td className="px-3 py-2 text-muted-foreground">
                      {linha.origin === "lote" ? "Repetido no lote" : "Já estava na base"}
                    </td>
                    <td className="auditor-num px-3 py-2 text-foreground">
                      {[linha.fac, linha.os].filter(Boolean).join(" / ") || "—"}
                    </td>
                    <td className="px-3 py-2 text-muted-foreground">{rotuloCelula(linha.existingCell)}</td>
                    <td className="auditor-num px-3 py-2 text-muted-foreground">{dataBR(linha.createdAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <Dialog open={apagarOpen} onOpenChange={setApagarOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{apagarTudo ? "Limpar registro de duplicados" : "Apagar registros selecionados"}</DialogTitle>
            <DialogDescription>
              {apagarTudo
                ? `Os ${linhas.length} registros de duplicidade serão apagados.`
                : `${selecionados.size} registro(s) de duplicidade serão apagados.`}{" "}
              Nenhum documento, FV/OS, foto ou célula será alterado.
            </DialogDescription>
          </DialogHeader>
          <p className="flex items-start gap-2 rounded-lg border border-warning/40 bg-warning/10 px-3 py-2 text-[11px] text-warning">
            <TriangleAlert className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            Apague primeiro os arquivos repetidos do computador usando o Excel. Este log serve de conferência.
          </p>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setApagarOpen(false)} disabled={busy}>
              Cancelar
            </Button>
            <Button type="button" variant="destructive" onClick={() => void apagar()} disabled={busy}>
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
              Apagar registros
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AuditorShell>
  );
}
