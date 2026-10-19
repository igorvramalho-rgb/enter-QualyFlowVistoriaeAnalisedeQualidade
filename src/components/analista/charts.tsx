import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Card } from "@/components/ui/card";

const TOOLTIP_STYLE = {
  backgroundColor: "hsl(var(--popover))",
  border: "1px solid hsl(var(--glass-border))",
  borderRadius: 10,
  color: "hsl(var(--popover-foreground))",
  fontSize: 12,
} as const;

const AXIS_STYLE = {
  fontSize: 11,
  fill: "hsl(var(--muted-foreground))",
} as const;

function ChartShell({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <Card className="panel-interactive overflow-hidden">
      <span className="tech-strip absolute inset-x-0 top-0" />
      <div className="relative p-4">
        <div className="mb-3">
          <h2 className="text-sm font-semibold text-foreground">{title}</h2>
          <p className="text-xs text-muted-foreground">{description}</p>
        </div>
        {children}
      </div>
    </Card>
  );
}

function EmptyChart({ message }: { message: string }) {
  return (
    <div className="flex h-[240px] items-center justify-center rounded-lg border border-dashed border-glass-border/60 bg-glass/30 px-4 text-center text-xs text-muted-foreground">
      {message}
    </div>
  );
}

export interface PoloDatum {
  polo: string;
  conforme: number;
  emAndamento: number;
  naoConforme: number;
  total: number;
}

export function PoloChart({ data }: { data: PoloDatum[] }) {
  return (
    <ChartShell
      title="Vistorias por Polo / Região"
      description="Distribuição das vistorias analisadas por situação de conformidade."
    >
      {data.length === 0 ? (
        <EmptyChart message="Sem vistorias distribuídas por polo ainda." />
      ) : (
        <div className="h-[260px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data} margin={{ top: 4, right: 8, bottom: 0, left: -18 }}>
              <defs>
                <linearGradient id="poloConforme" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="hsl(var(--success))" stopOpacity={0.95} />
                  <stop offset="100%" stopColor="hsl(var(--success))" stopOpacity={0.4} />
                </linearGradient>
                <linearGradient id="poloAndamento" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="hsl(var(--warning))" stopOpacity={0.95} />
                  <stop offset="100%" stopColor="hsl(var(--warning))" stopOpacity={0.4} />
                </linearGradient>
                <linearGradient id="poloNaoConforme" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="hsl(var(--destructive))" stopOpacity={0.95} />
                  <stop offset="100%" stopColor="hsl(var(--destructive))" stopOpacity={0.45} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--hairline))" vertical={false} />
              <XAxis dataKey="polo" tick={AXIS_STYLE} tickLine={false} axisLine={false} />
              <YAxis tick={AXIS_STYLE} tickLine={false} axisLine={false} allowDecimals={false} />
              <Tooltip contentStyle={TOOLTIP_STYLE} cursor={{ fill: "hsl(var(--accent))" }} />
              <Bar dataKey="conforme" name="Conforme" stackId="status" fill="url(#poloConforme)" />
              <Bar dataKey="emAndamento" name="Em andamento" stackId="status" fill="url(#poloAndamento)" />
              <Bar
                dataKey="naoConforme"
                name="Não conforme"
                stackId="status"
                fill="url(#poloNaoConforme)"
                radius={[4, 4, 0, 0]}
              />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
    </ChartShell>
  );
}

export interface StatusDatum {
  key: string;
  label: string;
  total: number;
  color: string;
}

export function StatusChart({ data }: { data: StatusDatum[] }) {
  const total = data.reduce((sum, item) => sum + item.total, 0);

  return (
    <ChartShell
      title="Concluídos x Pendentes"
      description={`${total} vistoria(s) classificadas por situação.`}
    >
      {total === 0 ? (
        <EmptyChart message="Nenhuma vistoria classificada ainda." />
      ) : (
        <div className="flex flex-col items-center gap-4 sm:flex-row">
          <div className="h-[220px] w-full max-w-[260px]">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={data.filter((item) => item.total > 0)}
                  dataKey="total"
                  nameKey="label"
                  innerRadius="58%"
                  outerRadius="88%"
                  paddingAngle={2}
                  stroke="hsl(var(--glass))"
                  strokeWidth={2}
                >
                  {data
                    .filter((item) => item.total > 0)
                    .map((item) => (
                      <Cell key={item.key} fill={item.color} />
                    ))}
                </Pie>
                <Tooltip contentStyle={TOOLTIP_STYLE} />
              </PieChart>
            </ResponsiveContainer>
          </div>

          <ul className="w-full space-y-2">
            {data.map((item) => (
              <li key={item.key} className="flex items-center justify-between gap-3 text-sm">
                <span className="flex items-center gap-2 text-muted-foreground">
                  <span
                    className="h-2.5 w-2.5 shrink-0 rounded-full"
                    style={{ backgroundColor: item.color, boxShadow: `0 0 10px ${item.color}` }}
                  />
                  {item.label}
                </span>
                <span className="font-medium text-foreground">{item.total}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </ChartShell>
  );
}

export interface NcTypeDatum {
  tipo: string;
  total: number;
}

export function NcTypeChart({ data }: { data: NcTypeDatum[] }) {
  return (
    <ChartShell
      title="Não conformidades por tipo"
      description="Tipos de não conformidade mais recorrentes nas vistorias analisadas."
    >
      {data.length === 0 ? (
        <EmptyChart message="Nenhum tipo de não conformidade registrado ainda. Importe PDFs ou preencha o tipo na revisão." />
      ) : (
        <div className="h-[260px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={data}
              layout="vertical"
              margin={{ top: 4, right: 16, bottom: 0, left: 8 }}
              barCategoryGap={10}
            >
              <defs>
                <linearGradient id="ncTipoFill" x1="0" y1="0" x2="1" y2="0">
                  <stop offset="0%" stopColor="hsl(var(--chart-1))" stopOpacity={0.95} />
                  <stop offset="100%" stopColor="hsl(var(--brand-green))" stopOpacity={0.7} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--hairline))" horizontal={false} />
              <XAxis type="number" tick={AXIS_STYLE} tickLine={false} axisLine={false} allowDecimals={false} />
              <YAxis
                type="category"
                dataKey="tipo"
                width={168}
                tick={AXIS_STYLE}
                tickLine={false}
                axisLine={false}
              />
              <Tooltip contentStyle={TOOLTIP_STYLE} cursor={{ fill: "hsl(var(--accent))" }} />
              <Bar dataKey="total" name="Vistorias" fill="url(#ncTipoFill)" radius={[0, 4, 4, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
    </ChartShell>
  );
}
