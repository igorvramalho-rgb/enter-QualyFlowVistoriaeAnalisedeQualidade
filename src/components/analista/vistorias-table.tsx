import { useMemo, useState } from "react";
import { ArrowDownUp, Download, Filter, Pencil, Trash2 } from "lucide-react";
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
import { downloadCsv } from "@/lib/csv";
import { parseAnyDate, stripAccents } from "@/lib/fields";
import {
  ANALYSIS_FIELDS,
  DOCUMENT_TYPE_LABELS,
  STATUS_LABELS,
  type AnalysisRecord,
  type QualityStatus,
} from "@/lib/analysis";
import { cn } from "@/lib/utils";

interface VistoriasTableProps {
  analyses: AnalysisRecord[];
  onReview: (record: AnalysisRecord) => void;
  onDelete: (recordId: string) => void;
}

type SortKey = "fileName" | "data" | "polo" | "status";

const STATUS_STYLES: Record<QualityStatus, string> = {
  conforme: "bg-success/15 text-success border-success/40",
  nao_conforme: "bg-destructive/12 text-destructive border-destructive/40",
  em_andamento: "bg-warning/15 text-warning border-warning/40",
  pendente: "bg-muted text-muted-foreground border-border",
};

const ALL = "todos";

export function VistoriasTable({ analyses, onReview, onDelete }: VistoriasTableProps) {
  const [query, setQuery] = useState("");
  const [polo, setPolo] = useState(ALL);
  const [status, setStatus] = useState(ALL);
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [sortKey, setSortKey] = useState<SortKey>("fileName");
  const [sortAsc, setSortAsc] = useState(true);

  const polos = useMemo(() => {
    const unique = new Set(
      analyses.map((item) => item.fields.polo?.trim()).filter((value): value is string => Boolean(value)),
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
        [item.fileName, item.fields.os, item.fields.endereco, item.fields.polo, item.fields.protocoloSgz]
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
      if (sortKey === "polo") {
        return (a.fields.polo ?? "").localeCompare(b.fields.polo ?? "", "pt-BR") * direction;
      }
      const left = parseAnyDate(a.fields.data ?? "")?.getTime() ?? 0;
      const right = parseAnyDate(b.fields.data ?? "")?.getTime() ?? 0;
      return (left - right) * direction;
    });
  }, [analyses, from, polo, query, sortAsc, sortKey, status, to]);

  const handleExport = () => {
    const headers = [
      "Arquivo",
      "Tipo de relatório",
      ...ANALYSIS_FIELDS.map((field) => field.label),
      "Status",
      "Revisado",
      "Páginas",
    ];

    const rows = filtered.map((item) => [
      item.fileName,
      DOCUMENT_TYPE_LABELS[item.documentType],
      ...ANALYSIS_FIELDS.map((field) => item.fields[field.key] ?? ""),
      STATUS_LABELS[item.status],
      item.reviewed ? "Sim" : "Não",
      String(item.pages),
    ]);

    downloadCsv(`qualyflow-vistorias-${new Date().toISOString().slice(0, 10)}`, headers, rows);
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
    <Card className="overflow-hidden border-border/70 bg-card/80 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border/70 px-4 py-3">
        <div>
          <h2 className="text-sm font-semibold text-foreground">Tratativas e vistorias analisadas</h2>
          <p className="text-xs text-muted-foreground">
            {filtered.length} de {analyses.length} registro(s) exibidos pelos filtros atuais.
          </p>
        </div>
        <Button type="button" variant="outline" size="sm" onClick={handleExport} disabled={filtered.length === 0}>
          <Download className="h-4 w-4" />
          Exportar CSV
        </Button>
      </div>

      <div className="grid gap-3 border-b border-border/70 bg-muted/30 px-4 py-3 sm:grid-cols-2 xl:grid-cols-4">
        <div className="relative">
          <Filter className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Buscar por OS, endereço ou protocolo"
            className="bg-background pl-9"
          />
        </div>

        <Select value={polo} onValueChange={setPolo}>
          <SelectTrigger className="bg-background">
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

        <Select value={status} onValueChange={setStatus}>
          <SelectTrigger className="bg-background">
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
            className="bg-background"
          />
          <span className="text-xs text-muted-foreground">até</span>
          <Input
            type="date"
            value={to}
            onChange={(event) => setTo(event.target.value)}
            aria-label="Data final"
            className="bg-background"
          />
        </div>
      </div>

      <div className="scroll-slim overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <SortableHead label="Arquivo" active={sortKey === "fileName"} asc={sortAsc} onClick={() => toggleSort("fileName")} />
              <TableHead className="whitespace-nowrap">Tipo</TableHead>
              <TableHead className="whitespace-nowrap">OS</TableHead>
              <SortableHead label="Polo" active={sortKey === "polo"} asc={sortAsc} onClick={() => toggleSort("polo")} />
              <TableHead className="whitespace-nowrap">Endereço</TableHead>
              <SortableHead label="Data" active={sortKey === "data"} asc={sortAsc} onClick={() => toggleSort("data")} />
              <SortableHead label="Status" active={sortKey === "status"} asc={sortAsc} onClick={() => toggleSort("status")} />
              <TableHead className="text-right">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.length === 0 ? (
              <TableRow>
                <TableCell colSpan={8} className="py-10 text-center text-sm text-muted-foreground">
                  Nenhuma vistoria encontrada com os filtros atuais.
                </TableCell>
              </TableRow>
            ) : (
              filtered.map((item) => (
                <TableRow key={item.id}>
                  <TableCell className="max-w-[220px]">
                    <p className="truncate text-sm font-medium text-foreground" title={item.fileName}>
                      {item.fileName}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {item.pages} pág. •{" "}
                      {item.source === "sem-texto"
                        ? "PDF digitalizado"
                        : item.source === "nome-do-arquivo"
                          ? "dados do nome do arquivo"
                          : "texto extraído"}
                      {item.reviewed ? " • revisado" : ""}
                    </p>
                  </TableCell>
                  <TableCell className="whitespace-nowrap text-xs text-muted-foreground">
                    {DOCUMENT_TYPE_LABELS[item.documentType]}
                  </TableCell>
                  <TableCell className="whitespace-nowrap text-sm">{item.fields.os || "—"}</TableCell>
                  <TableCell className="whitespace-nowrap text-sm">{item.fields.polo || "—"}</TableCell>
                  <TableCell className="max-w-[220px]">
                    <span className="block truncate text-sm" title={item.fields.endereco}>
                      {item.fields.endereco || "—"}
                    </span>
                  </TableCell>
                  <TableCell className="whitespace-nowrap text-sm">{item.fields.data || "—"}</TableCell>
                  <TableCell>
                    <Badge
                      variant="outline"
                      className={cn("border whitespace-nowrap text-[11px]", STATUS_STYLES[item.status])}
                    >
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
