import { useMemo, useState } from "react";
import { ArrowDownUp, FileSpreadsheet, Filter, Pencil, Sheet, Trash2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { toast } from "@/components/ui/sonner";
import { buildAnalysisMatrix, SOURCE_LABELS } from "@/lib/analysis-export";
import {
  normalizeNcType,
  STATUS_LABELS,
  type AnalysisRecord,
  type QualityStatus,
} from "@/lib/analysis";
import { downloadCsv } from "@/lib/csv";
import { parseAnyDate, stripAccents } from "@/lib/fields";
import { downloadXlsx } from "@/lib/xlsx-export";
import { cn } from "@/lib/utils";

interface VistoriasTableProps {
  analyses: AnalysisRecord[];
  onReview: (record: AnalysisRecord) => void;
  onDelete: (recordId: string) => void;
}

type SortKey = "fileName" | "data" | "polo" | "status" | "fv" | "os";

const STATUS_STYLES: Record<QualityStatus, string> = {
  conforme: "bg-success/15 text-success border-success/40",
  nao_conforme: "bg-destructive/12 text-destructive border-destructive/40",
  em_andamento: "bg-warning/15 text-warning border-warning/40",
  pendente: "bg-muted text-muted-foreground border-border",
};

const STATUS_DOTS: Record<QualityStatus, string> = {
  conforme: "bg-success",
  nao_conforme: "bg-destructive",
  em_andamento: "bg-warning",
  pendente: "bg-muted-foreground",
};

const ALL = "todos";

export function VistoriasTable({ analyses, onReview, onDelete }: VistoriasTableProps) {
  const [query, setQuery] = useState("");
  const [polo, setPolo] = useState(ALL);
  const [status, setStatus] = useState(ALL);
  const [tipo, setTipo] = useState(ALL);
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [sortKey, setSortKey] = useState<SortKey>("data");
  const [sortAsc, setSortAsc] = useState(false);
  const [exporting, setExporting] = useState(false);

  const polos = useMemo(() => {
    const unique = new Set(
      analyses.map((item) => item.fields.polo?.trim()).filter((value): value is string => Boolean(value)),
    );
    return Array.from(unique).sort((a, b) => a.localeCompare(b, "pt-BR"));
  }, [analyses]);

  const tipos = useMemo(() => {
    const unique = new Set(
      analyses.map((item) => normalizeNcType(item.fields.tipoNaoConformidade)).filter(Boolean),
    );
    return Array.from(unique).sort((a, b) => a.localeCompare(b, "pt-BR"));
  }, [analyses]);

  const filtered = useMemo(() => {
    const term = stripAccents(query.trim().toLowerCase());
    const fromDate = from ? new Date(`${from}T00:00:00`) : null;
    const toDate = to ? new Date(`${to}T23:59:59`) : null;

    const rows = analyses.filter((item) => {
      if (polo !== ALL && (item.fields.polo ?? "") !== polo) {
        return false;
      }
      if (status !== ALL && item.status !== status) {
        return false;
      }
      if (tipo !== ALL && normalizeNcType(item.fields.tipoNaoConformidade) !== tipo) {
        return false;
      }

      const recordDate = parseAnyDate(item.fields.data ?? "");
      if (fromDate && (!recordDate || recordDate < fromDate)) {
        return false;
      }
      if (toDate && (!recordDate || recordDate > toDate)) {
        return false;
      }

      if (!term) {
        return true;
      }

      const haystack = stripAccents(
        [
          item.fileName,
          item.fields.os,
          item.fields.fv,
          item.fields.endereco,
          item.fields.polo,
          item.fields.protocoloSgz,
          item.fields.equipeExecutante,
          item.fields.tipoNaoConformidade,
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase(),
      );
      return haystack.includes(term);
    });

    return rows.sort((a, b) => {
      const direction = sortAsc ? 1 : -1;
      if (sortKey === "fileName") {
        return a.fileName.localeCompare(b.fileName, "pt-BR") * direction;
      }
      if (sortKey === "status") {
        return a.status.localeCompare(b.status) * direction;
      }
      if (sortKey === "fv") {
        return (a.fields.fv ?? "").localeCompare(b.fields.fv ?? "", "pt-BR") * direction;
      }
      if (sortKey === "os") {
        return (a.fields.os ?? "").localeCompare(b.fields.os ?? "", "pt-BR") * direction;
      }
      if (sortKey === "polo") {
        return (a.fields.polo ?? "").localeCompare(b.fields.polo ?? "", "pt-BR") * direction;
      }
      const left = parseAnyDate(a.fields.data ?? "")?.getTime() ?? 0;
      const right = parseAnyDate(b.fields.data ?? "")?.getTime() ?? 0;
      return (left - right) * direction;
    });
  }, [analyses, from, polo, query, sortAsc, sortKey, status, tipo, to]);

  const exportMatrix = () => buildAnalysisMatrix(filtered);

  const handleExportCsv = () => {
    const { headers, rows } = exportMatrix();
    downloadCsv(`qualyflow-vistorias-${new Date().toISOString().slice(0, 10)}`, headers, rows);
  };

  const handleExportXlsx = async () => {
    const { headers, rows } = exportMatrix();
    setExporting(true);
    try {
      await downloadXlsx(
        `qualyflow-vistorias-${new Date().toISOString().slice(0, 10)}`,
        "Vistorias",
        headers,
        rows,
      );
      toast.success("Planilha Excel gerada", {
        description: `${rows.length} registro(s) exportado(s).`,
      });
    } catch {
      toast.error("Não foi possível gerar a planilha Excel");
    } finally {
      setExporting(false);
    }
  };

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortAsc((previous) => !previous);
      return;
    }
    setSortKey(key);
    setSortAsc(true);
  };

  return (
    <Card className="overflow-hidden">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-glass-border/40 px-4 py-3">
        <div>
          <h2 className="text-sm font-semibold text-foreground">Tratativas e vistorias analisadas</h2>
          <p className="text-xs text-muted-foreground">
            {filtered.length} de {analyses.length} registro(s) exibidos pelos filtros atuais.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button
            type="button"
            variant="glass"
            size="sm"
            onClick={handleExportCsv}
            disabled={filtered.length === 0}
          >
            <Sheet className="h-4 w-4" />
            Exportar CSV
          </Button>
          <Button
            type="button"
            variant="glow"
            size="sm"
            onClick={() => void handleExportXlsx()}
            disabled={filtered.length === 0 || exporting}
          >
            <FileSpreadsheet className="h-4 w-4" />
            Baixar Excel (.xlsx)
          </Button>
        </div>
      </div>

      <div className="grid gap-3 border-b border-glass-border/40 bg-glass/30 px-4 py-3 sm:grid-cols-2 xl:grid-cols-5">
        <div className="relative">
          <Filter className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Buscar por OS, FV, endereço ou equipe"
            className="bg-background/70 pl-9"
          />
        </div>

        <Select value={polo} onValueChange={setPolo}>
          <SelectTrigger className="bg-background/70">
            <SelectValue placeholder="Polo" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>Todos os polos</SelectItem>
            {polos.map((option) => (
              <SelectItem key={option} value={option}>
                {option}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={tipo} onValueChange={setTipo}>
          <SelectTrigger className="bg-background/70">
            <SelectValue placeholder="Tipo de não conformidade" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>Todos os tipos de NC</SelectItem>
            {tipos.map((option) => (
              <SelectItem key={option} value={option}>
                {option}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={status} onValueChange={setStatus}>
          <SelectTrigger className="bg-background/70">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>Todos os status</SelectItem>
            {Object.entries(STATUS_LABELS).map(([value, label]) => (
              <SelectItem key={value} value={value}>
                {label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <div className="flex items-center gap-2">
          <Input
            type="date"
            value={from}
            onChange={(event) => setFrom(event.target.value)}
            aria-label="Data inicial"
            className="bg-background/70"
          />
          <span className="text-xs text-muted-foreground">até</span>
          <Input
            type="date"
            value={to}
            onChange={(event) => setTo(event.target.value)}
            aria-label="Data final"
            className="bg-background/70"
          />
        </div>
      </div>

      <div className="scroll-slim overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <SortableHead label="Arquivo" active={sortKey === "fileName"} asc={sortAsc} onClick={() => toggleSort("fileName")} />
              <SortableHead label="FV" active={sortKey === "fv"} asc={sortAsc} onClick={() => toggleSort("fv")} />
              <SortableHead label="Ordem de serviço" active={sortKey === "os"} asc={sortAsc} onClick={() => toggleSort("os")} />
              <SortableHead label="Data" active={sortKey === "data"} asc={sortAsc} onClick={() => toggleSort("data")} />
              <SortableHead label="Polo" active={sortKey === "polo"} asc={sortAsc} onClick={() => toggleSort("polo")} />
              <TableHead className="whitespace-nowrap">Endereço</TableHead>
              <TableHead className="whitespace-nowrap">Não conformidade</TableHead>
              <SortableHead label="Status" active={sortKey === "status"} asc={sortAsc} onClick={() => toggleSort("status")} />
              <TableHead className="text-right">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.length === 0 ? (
              <TableRow>
                <TableCell colSpan={9} className="py-10 text-center text-sm text-muted-foreground">
                  Nenhuma vistoria encontrada com os filtros atuais.
                </TableCell>
              </TableRow>
            ) : (
              filtered.map((item) => (
                <TableRow key={item.id} className="transition-smooth hover:bg-accent/40">
                  <TableCell className="max-w-[220px]">
                    <p className="truncate text-sm font-medium text-foreground" title={item.fileName}>
                      {item.fileName}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {item.pages} pág. • {SOURCE_LABELS[item.source]}
                      {item.reviewed ? " • revisado" : ""}
                    </p>
                  </TableCell>
                  <TableCell className="whitespace-nowrap">
                    <span className="chip-tech font-mono text-[11px] text-foreground">
                      {item.fields.fv || "—"}
                    </span>
                  </TableCell>
                  <TableCell className="whitespace-nowrap font-mono text-xs text-foreground">
                    {item.fields.os || "—"}
                  </TableCell>
                  <TableCell className="whitespace-nowrap text-sm">{item.fields.data || "—"}</TableCell>
                  <TableCell className="whitespace-nowrap text-sm">{item.fields.polo || "—"}</TableCell>
                  <TableCell className="max-w-[220px]">
                    <span className="block truncate text-sm" title={item.fields.endereco}>
                      {item.fields.endereco || "—"}
                    </span>
                  </TableCell>
                  <TableCell className="max-w-[220px]">
                    <span className="block truncate text-sm text-foreground" title={item.fields.tipoNaoConformidade}>
                      {item.fields.tipoNaoConformidade || "—"}
                    </span>
                    <span className="block truncate text-xs text-muted-foreground" title={item.fields.equipeExecutante}>
                      {item.fields.equipeExecutante ? `Equipe: ${item.fields.equipeExecutante}` : "Equipe não informada"}
                    </span>
                  </TableCell>
                  <TableCell>
                    <Badge
                      variant="outline"
                      className={cn("gap-1.5 border whitespace-nowrap text-[11px]", STATUS_STYLES[item.status])}
                    >
                      <span className={cn("h-1.5 w-1.5 rounded-full", STATUS_DOTS[item.status])} />
                      {STATUS_LABELS[item.status]}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-1">
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => onReview(item)}
                        aria-label={`Revisar ${item.fileName}`}
                      >
                        <Pencil className="h-4 w-4" />
                        Revisar
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="text-muted-foreground hover:text-destructive"
                        onClick={() => onDelete(item.id)}
                        aria-label={`Excluir ${item.fileName}`}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </Card>
  );
}

interface SortableHeadProps {
  label: string;
  active: boolean;
  asc: boolean;
  onClick: () => void;
}

function SortableHead({ label, active, asc, onClick }: SortableHeadProps) {
  return (
    <TableHead className="whitespace-nowrap">
      <button
        type="button"
        onClick={onClick}
        className={cn(
          "flex items-center gap-1 text-xs font-medium transition-smooth hover:text-foreground",
          active ? "text-foreground" : "text-muted-foreground",
        )}
      >
        {label}
        <ArrowDownUp className={cn("h-3 w-3", active && !asc && "rotate-180")} />
      </button>
    </TableHead>
  );
}
