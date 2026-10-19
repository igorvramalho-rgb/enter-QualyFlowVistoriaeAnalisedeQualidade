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
  border: "1px solid hsl(var(--border))",
  borderRadius: 10,
  color: "hsl(var(--popover-foreground))",
  fontSize: 12,
} as const;

const AXIS_STYLE = {
  fontSize: 11,
  fill: "hsl(var(--muted-foreground))",
} as const;

export interface PoloDatum {
  polo: string;
  conforme: number;
  emAndamento: number;
  naoConforme: number;
  total: number;
}

export function PoloChart({ data }: { data: PoloDatum[] }) {
  return (
    <Card className="border-border/70 bg-card/80 p-4 shadow-sm">
      <div className="mb-3">
        <h2 className="text-sm font-semibold text-foreground">Vistorias por Polo / Região</h2>
        <p className="text-xs text-muted-foreground">
          Distribuição das vistorias analisadas por situação de conformidade.
        </p>
      </div>

      <div className="h-[280px] w-full">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ top: 4, right: 8, bottom: 0, left: -18 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
            <XAxis dataKey="polo" tick={AXIS_STYLE} tickLine={false} axisLine={false} />
            <YAxis tick={AXIS_STYLE} tickLine={false} axisLine={false} allowDecimals={false} />
            <Tooltip contentStyle={TOOLTIP_STYLE} cursor={{ fill: "hsl(var(--accent))" }} />
            <Bar dataKey="conforme" name="Conforme" stackId="status" fill="hsl(var(--success))" />
            <Bar dataKey="emAndamento" name="Em andamento" stackId="status" fill="hsl(var(--warning))" />
            <Bar
              dataKey="naoConforme"
              name="Não conforme"
              stackId="status"
              fill="hsl(var(--destructive))"
              radius={[4, 4, 0, 0]}
            />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </Card>
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
    <Card className="border-border/70 bg-card/80 p-4 shadow-sm">
      <div className="mb-3">
        <h2 className="text-sm font-semibold text-foreground">Concluídos x Pendentes</h2>
        <p className="text-xs text-muted-foreground">
          {total} vistoria(s) classificadas por situação.
        </p>
      </div>

      <div className="flex flex-col items-center gap-4 sm:flex-row">
        <div className="h-[220px] w-full max-w-[280px]">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={data}
                dataKey="total"
                nameKey="label"
                innerRadius="55%"
                outerRadius="85%"
                paddingAngle={2}
                stroke="hsl(var(--card))"
                strokeWidth={2}
              >
                {data.map((item) => (
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
                  style={{ backgroundColor: item.color }}
                />
                {item.label}
              </span>
              <span className="font-medium text-foreground">{item.total}</span>
            </li>
          ))}
        </ul>
      </div>
    </Card>
  );
}
