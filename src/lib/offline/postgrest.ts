/**
 * Emulação local do PostgREST usada apenas quando a nuvem não responde.
 *
 * O app conversa com um único cliente (supabase-js). Quando a nuvem pausa,
 * esta camada responde às mesmas requisições usando a cópia local das tabelas,
 * aplica as alterações e registra cada gravação para sincronizar depois.
 */

import { enqueue, readRows, writeRows } from "@/lib/offline/db";

type Row = Record<string, unknown>;
type SelectNode =
  | { kind: "star" }
  | { kind: "column"; column: string; alias: string }
  | { kind: "relation"; relation: string; children: SelectNode[] };

const RESERVED = new Set(["select", "order", "limit", "offset", "on_conflict", "columns", "or", "and", "not"]);

const TABLES_WITH_ID = new Set([
  "qa_cases",
  "qa_documents",
  "qa_document_items",
  "qa_case_events",
  "qa_cycles",
  "qa_redo",
  "qa_reports",
  "qa_sniper_documents",
  "qa_duplicate_uploads",
  "qualyflow_analyses",
  "qualyflow_reports",
]);

const TABLES_WITH_CREATED_AT = new Set([
  "qa_cases",
  "qa_documents",
  "qa_document_items",
  "qa_case_events",
  "qa_cycles",
  "qa_redo",
  "qa_reports",
  "qa_sniper_documents",
  "qa_duplicate_uploads",
  "qualyflow_analyses",
  "qualyflow_reports",
  "qualyflow_profiles",
]);

const TABLES_WITH_UPDATED_AT = new Set([
  "qa_cases",
  "qa_documents",
  "qa_redo",
  "qa_reports",
  "qa_sniper_documents",
  "qualyflow_analyses",
  "qualyflow_reports",
  "qualyflow_profiles",
  "qualyflow_settings",
  "qualyflow_user_settings",
]);

function uuid(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (char) => {
    const random = (Math.random() * 16) | 0;
    const value = char === "x" ? random : (random & 0x3) | 0x8;
    return value.toString(16);
  });
}

function jsonResponse(body: unknown, status = 200, extra: Record<string, string> = {}): Response {
  return new Response(body === undefined ? null : JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", ...extra },
  });
}

function emptyResponse(status = 204, extra: Record<string, string> = {}): Response {
  return new Response(null, { status, headers: extra });
}

/* --------------------------------------------------------------- projeção */

function splitTopLevel(value: string): string[] {
  const parts: string[] = [];
  let depth = 0;
  let current = "";
  for (const char of value) {
    if (char === "(") depth += 1;
    if (char === ")") depth = Math.max(0, depth - 1);
    if (char === "," && depth === 0) {
      if (current.trim()) parts.push(current.trim());
      current = "";
      continue;
    }
    current += char;
  }
  if (current.trim()) parts.push(current.trim());
  return parts;
}

function parseSelect(select: string): SelectNode[] {
  if (!select.trim()) {
    return [{ kind: "star" }];
  }
  return splitTopLevel(select).map((token) => {
    const open = token.indexOf("(");
    if (open >= 0 && token.endsWith(")")) {
      const relation = token.slice(0, open).replace(/![a-z]+$/, "");
      const children = parseSelect(token.slice(open + 1, -1));
      return { kind: "relation", relation, children };
    }
    if (token === "*") {
      return { kind: "star" };
    }
    const aliasSplit = token.split(":");
    if (aliasSplit.length === 2) {
      return { kind: "column", alias: aliasSplit[0], column: aliasSplit[1] };
    }
    return { kind: "column", column: token, alias: token };
  });
}

function projectRow(row: Row, nodes: SelectNode[], table: string): Row {
  if (nodes.some((node) => node.kind === "star")) {
    return { ...row };
  }
  const output: Row = {};
  for (const node of nodes) {
    if (node.kind === "column") {
      output[node.alias] = row[node.column] ?? null;
      continue;
    }
    if (node.kind === "relation") {
      output[node.relation] = row[node.relation] ?? null;
    }
  }
  return output;
}

function projectMany(rows: Row[], select: string | null, table: string): Row[] {
  const nodes = parseSelect(select ?? "*");
  return rows.map((row) => projectRow(row, nodes, table));
}

/* ----------------------------------------------------------------- filtros */

const OR_SEPARATOR = /,(?![^(]*\))/;

function normalize(value: unknown): string {
  if (value === null || value === undefined) return "";
  if (typeof value === "boolean") return value ? "true" : "false";
  return String(value);
}

function compareValues(left: unknown, right: string, op: "gt" | "gte" | "lt" | "lte"): boolean {
  const leftNumber = Number(left);
  const rightNumber = Number(right);
  if (Number.isFinite(leftNumber) && Number.isFinite(rightNumber) && right.trim() !== "") {
    if (op === "gt") return leftNumber > rightNumber;
    if (op === "gte") return leftNumber >= rightNumber;
    if (op === "lt") return leftNumber < rightNumber;
    return leftNumber <= rightNumber;
  }
  const a = normalize(left);
  if (op === "gt") return a > right;
  if (op === "gte") return a >= right;
  if (op === "lt") return a < right;
  return a <= right;
}

function matchExpression(value: unknown, expression: string): boolean {
  const negative = expression.startsWith("not.");
  const expr = negative ? expression.slice(4) : expression;
  const dot = expr.indexOf(".");
  if (dot < 0) {
    return false;
  }
  const op = expr.slice(0, dot);
  const target = expr.slice(dot + 1);
  let result = false;

  switch (op) {
    case "eq":
      result = normalize(value) === target;
      break;
    case "neq":
      result = normalize(value) !== target;
      break;
    case "is":
      if (target === "null") result = value === null || value === undefined;
      else if (target === "true") result = value === true || value === "true";
      else if (target === "false") result = value === false || value === "false";
      break;
    case "in": {
      const list = target.replace(/^\(/, "").replace(/\)$/, "").split(",").map((item) => item.replace(/^"|"$/g, ""));
      result = list.includes(normalize(value));
      break;
    }
    case "gt":
      result = compareValues(value, target, "gt");
      break;
    case "gte":
      result = compareValues(value, target, "gte");
      break;
    case "lt":
      result = compareValues(value, target, "lt");
      break;
    case "lte":
      result = compareValues(value, target, "lte");
      break;
    case "like": {
      const pattern = new RegExp(`^${target.replace(/[.*+?^${}()|[\]\\]/g, "\\$&").replace(/%/g, ".*").replace(/_/g, ".")}$`);
      result = pattern.test(normalize(value));
      break;
    }
    case "ilike": {
      const pattern = new RegExp(
        `^${target.replace(/[.*+?^${}()|[\]\\]/g, "\\$&").replace(/%/g, ".*").replace(/_/g, ".")}$`,
        "i",
      );
      result = pattern.test(normalize(value));
      break;
    }
    default:
      result = false;
  }

  return negative ? !result : result;
}

function matchOrGroup(row: Row, group: string): boolean {
  const inner = group.replace(/^\(/, "").replace(/\)$/, "");
  return inner.split(OR_SEPARATOR).some((part) => {
    const dot = part.indexOf(".");
    if (dot < 0) return false;
    const column = part.slice(0, dot);
    return matchExpression(row[column], part.slice(dot + 1));
  });
}

function applyFilters(rows: Row[], params: URLSearchParams): Row[] {
  let result = rows;
  for (const [key, value] of params.entries()) {
    if (RESERVED.has(key)) {
      if (key === "or" || key === "and") {
        result = result.filter((row) => matchOrGroup(row, value));
      }
      if (key === "not") {
        result = result.filter((row) => !matchOrGroup(row, value));
      }
      continue;
    }
    result = result.filter((row) => matchExpression(row[key], value));
  }
  return result;
}

function applyOrder(rows: Row[], values: string[]): Row[] {
  const orders = values
    .flatMap((value) => value.split(","))
    .map((token) => token.trim())
    .filter(Boolean)
    .map((token) => {
      const [column, direction = "asc"] = token.split(".");
      return { column, descending: direction.toLowerCase().startsWith("desc") };
    });

  if (orders.length === 0) {
    return rows;
  }

  return [...rows].sort((left, right) => {
    for (const order of orders) {
      const a = left[order.column];
      const b = right[order.column];
      if (a === b) continue;
      if (a === null || a === undefined || a === "") return order.descending ? 1 : -1;
      if (b === null || b === undefined || b === "") return order.descending ? -1 : 1;
      const result = String(a).localeCompare(String(b), "pt-BR", { numeric: true });
      if (result !== 0) {
        return order.descending ? -result : result;
      }
    }
    return 0;
  });
}

/* --------------------------------------------------------------- relações */

async function withRelations(rows: Row[], nodes: SelectNode[], table: string): Promise<Row[]> {
  const relations = nodes.filter((node): node is Extract<SelectNode, { kind: "relation" }> => node.kind === "relation");
  if (relations.length === 0) {
    return rows;
  }

  // Carrega a tabela relacionada uma única vez (a lista pode ter milhares de linhas).
  const documents = relations.some((relation) => table === "qa_cases" && relation.relation === "qa_documents")
    ? await readRows<Row>("qa_documents")
    : [];
  const documentsById = new Map(documents.map((document) => [String(document.id ?? ""), document]));

  const patients = relations.some((relation) => table === "qa_documents" && relation.relation === "qa_cases")
    ? await readRows<Row>("qa_cases")
    : [];
  const casesByDocument = new Map<string, Row[]>();
  for (const item of patients) {
    const key = String(item.document_id ?? "");
    const list = casesByDocument.get(key) ?? [];
    list.push(item);
    casesByDocument.set(key, list);
  }

  return rows.map((row) => {
    const next: Row = { ...row };
    for (const relation of relations) {
      if (table === "qa_cases" && relation.relation === "qa_documents") {
        const document = documentsById.get(String(row.document_id ?? ""));
        next[relation.relation] = document
          ? projectRow(document, relation.children, "qa_documents")
          : null;
      } else if (table === "qa_documents" && relation.relation === "qa_cases") {
        const related = casesByDocument.get(String(row.id ?? "")) ?? [];
        next[relation.relation] = related.map((item) =>
          projectRow(item, relation.children, "qa_cases"),
        );
      } else {
        next[relation.relation] = null;
      }
    }
    return next;
  });
}

/* -------------------------------------------------------------- mutações */

interface MutationOutcome {
  rows: Row[];
  enqueue: boolean;
  status: number;
}

async function applyInsert(table: string, bodyText: string | null, params: URLSearchParams): Promise<MutationOutcome> {
  const parsed = bodyText ? (JSON.parse(bodyText) as Row | Row[]) : {};
  const incoming = Array.isArray(parsed) ? parsed : [parsed];
  const conflict = params.get("on_conflict") ?? "id";
  const merge = true; // inserts locais sempre podem repetir sem duplicar por id
  const rows = await readRows<Row>(table);
  const now = new Date().toISOString();
  const effective: Row[] = [];

  for (const raw of incoming) {
    const row: Row = { ...raw };
    const conflictValue = row[conflict];
    const index =
      conflictValue === undefined || conflictValue === null
        ? -1
        : rows.findIndex((existing) => existing[conflict] === conflictValue);

    if (merge && index >= 0) {
      const merged: Row = { ...rows[index], ...row };
      // Chave de conflito diferente de "id" (ex.: fingerprint): preserva o id local.
      if (conflict !== "id" && rows[index].id) {
        merged.id = rows[index].id;
      }
      if (TABLES_WITH_UPDATED_AT.has(table)) {
        merged.updated_at = now;
      }
      rows[index] = merged;
      effective.push(merged);
      continue;
    }

    if (TABLES_WITH_ID.has(table) && !row.id) {
      row.id = uuid();
    }
    if (TABLES_WITH_CREATED_AT.has(table) && !row.created_at) {
      row.created_at = now;
    }
    if (TABLES_WITH_UPDATED_AT.has(table) && !row.updated_at) {
      row.updated_at = now;
    }
    if (table === "qa_documents" && !row.imported_at) {
      row.imported_at = now;
    }
    rows.push(row);
    effective.push(row);
  }

  await writeRows(table, rows);
  return { rows: effective, enqueue: true, status: 201 };
}

async function applyUpdate(
  table: string,
  bodyText: string | null,
  params: URLSearchParams,
): Promise<MutationOutcome> {
  const patch = bodyText ? (JSON.parse(bodyText) as Row) : {};
  const rows = await readRows<Row>(table);
  const matched = applyFilters(rows, params);
  const matchedRows = new Set(matched);
  const now = new Date().toISOString();
  const updated: Row[] = [];

  const next = rows.map((row) => {
    if (!matchedRows.has(row)) {
      return row;
    }
    const merged: Row = { ...row, ...patch };
    if (TABLES_WITH_UPDATED_AT.has(table) && !("updated_at" in patch)) {
      merged.updated_at = now;
    }
    updated.push(merged);
    return merged;
  });

  await writeRows(table, next);
  return { rows: updated, enqueue: true, status: 200 };
}

async function applyDelete(table: string, params: URLSearchParams): Promise<MutationOutcome> {
  const rows = await readRows<Row>(table);
  const matched = applyFilters(rows, params);
  const matchedSet = new Set(matched);
  await writeRows(
    table,
    rows.filter((row) => !matchedSet.has(row)),
  );
  return { rows: matched, enqueue: true, status: 200 };
}

function wantsRepresentation(headers: Headers): boolean {
  return /return=representation/.test(headers.get("prefer") ?? "");
}

function wantsSingle(headers: Headers): boolean {
  return (headers.get("accept") ?? "").includes("vnd.pgrst.object+json");
}

function errorResponse(message: string, status: number, code: string): Response {
  return jsonResponse({ code, message, details: null, hint: null }, status);
}

/**
 * Serializa as gravações de uma mesma tabela. A importação roda com três
 * arquivos em paralelo; sem isso, duas inserções poderiam ler a mesma cópia e
 * uma sobrescrever a outra.
 */
const tableLocks = new Map<string, Promise<unknown>>();

function withTableLock<T>(table: string, action: () => Promise<T>): Promise<T> {
  const previous = tableLocks.get(table) ?? Promise.resolve();
  const next = previous.then(action, action);
  tableLocks.set(
    table,
    next.catch(() => undefined),
  );
  return next;
}

/* ------------------------------------------------------------------ entrada */

export interface LocalRestInput {
  method: string;
  url: URL;
  headers: Headers;
  bodyText: string | null;
}

export async function handleLocalRest(input: LocalRestInput): Promise<Response> {
  const table = input.url.pathname.replace(/^\/rest\/v1\//, "").replace(/\/$/, "");
  if (!table || table.includes("/")) {
    return errorResponse("Recurso não disponível no modo local.", 404, "PGRST404");
  }

  const params = input.url.searchParams;
  const method = input.method.toUpperCase();
  const select = params.get("select");
  const single = wantsSingle(input.headers);

  let outcome: MutationOutcome | null = null;
  if (method === "POST") {
    outcome = await withTableLock(table, async () => {
      const result = await applyInsert(table, input.bodyText, params);
      // O corpo enviado à fila inclui o id gerado localmente: sem ele a
      // tratativa criada offline não teria como ser vinculada depois.
      await queueRest("POST", input, JSON.stringify(result.rows));
      return result;
    });
  } else if (method === "PATCH") {
    outcome = await withTableLock(table, async () => {
      const result = await applyUpdate(table, input.bodyText, params);
      await queueRest("PATCH", input);
      return result;
    });
  } else if (method === "DELETE") {
    outcome = await withTableLock(table, async () => {
      const result = await applyDelete(table, params);
      await queueRest("DELETE", input);
      return result;
    });
  }

  if (outcome) {
    if (!wantsRepresentation(input.headers)) {
      return emptyResponse(outcome.status === 201 ? 201 : 204);
    }
    const projected = await projectWithRelations(outcome.rows, select, table);
    if (single) {
      if (projected.length !== 1) {
        return errorResponse("JSON object requested, multiple (or no) rows returned", 406, "PGRST116");
      }
      return jsonResponse(projected[0], outcome.status);
    }
    return jsonResponse(projected, outcome.status);
  }

  // Leitura.
  const rows = await readRows<Row>(table);
  const filtered = applyFilters(rows, params);
  const ordered = applyOrder(filtered, params.getAll("order"));
  const requestedCount = /count=exact/.test(input.headers.get("prefer") ?? "");

  let start = 0;
  let end = ordered.length;
  const limitParam = params.get("limit");
  const offsetParam = params.get("offset");
  if (limitParam !== null) {
    start = offsetParam ? Number(offsetParam) : 0;
    end = start + Number(limitParam);
  }
  const range = input.headers.get("range");
  if (range) {
    const [from, to] = range.split("-").map((value) => Number(value));
    if (Number.isFinite(from)) start = from;
    if (Number.isFinite(to)) end = to + 1;
  }
  const sliced = ordered.slice(start, end);
  const total = filtered.length;

  const headers: Record<string, string> = {};
  if (requestedCount || range) {
    const last = sliced.length > 0 ? start + sliced.length - 1 : start;
    headers["Content-Range"] = `${start}-${last}/${total}`;
  }

  if (method === "HEAD") {
    return emptyResponse(200, headers);
  }

  const projected = await projectWithRelations(sliced, select, table);

  if (single) {
    if (projected.length !== 1) {
      return errorResponse("JSON object requested, multiple (or no) rows returned", 406, "PGRST116");
    }
    return jsonResponse(projected[0], 200, headers);
  }

  return jsonResponse(projected, 200, headers);
}

async function projectWithRelations(rows: Row[], select: string | null, table: string): Promise<Row[]> {
  const nodes = parseSelect(select ?? "*");
  const withJoins = await withRelations(rows, nodes, table);
  return withJoins.map((row) => projectRow(row, nodes, table));
}

function queueRest(method: string, input: LocalRestInput, bodyOverride?: string): Promise<unknown> {
  const headers: Record<string, string> = {};
  for (const name of ["accept", "content-type", "prefer"]) {
    const value = input.headers.get(name);
    if (value) headers[name] = value;
  }
  return enqueue({
    kind: "rest",
    method,
    url: input.url.toString(),
    headers,
    body: bodyOverride ?? input.bodyText ?? undefined,
    createdAt: Date.now(),
    attempts: 0,
  });
}
