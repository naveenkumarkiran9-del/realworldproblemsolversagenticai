import { Area, AreaChart, CartesianGrid, Line, ComposedChart, ResponsiveContainer, Tooltip, XAxis, YAxis, Bar } from "recharts";
import { shortDate, usd, compact } from "@/lib/format";

const axis = { stroke: "var(--muted-foreground)", fontSize: 11, tickLine: false, axisLine: false } as const;

function TooltipBox({ active, payload, label, money = true }: { active?: boolean; payload?: { name: string; value: number; color: string }[]; label?: string; money?: boolean }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-lg border bg-popover px-3 py-2 text-xs shadow-lg">
      <div className="mb-1 text-muted-foreground">{label ? shortDate(label) : ""} · demo</div>
      {payload.map((p) => (
        <div key={p.name} className="num flex items-center gap-2">
          <span className="size-2 rounded-full" style={{ background: p.color }} />
          <span className="text-muted-foreground">{p.name}</span>
          <span className="ml-auto font-semibold">{money && p.name !== "Volume" ? usd(p.value) : compact(p.value)}</span>
        </div>
      ))}
    </div>
  );
}

export function EquityChart({ data, height = 260 }: { data: { date: string; value: number }[]; height?: number }) {
  const up = (data.at(-1)?.value ?? 0) >= (data[0]?.value ?? 0);
  const color = up ? "var(--success)" : "var(--destructive)";
  return (
    <div style={{ height }}>
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 8, right: 4, left: 4, bottom: 0 }}>
          <defs>
            <linearGradient id="eq-fill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={color} stopOpacity={0.35} />
              <stop offset="100%" stopColor={color} stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid stroke="var(--border)" strokeDasharray="3 6" vertical={false} />
          <XAxis dataKey="date" {...axis} tickFormatter={shortDate} minTickGap={40} />
          <YAxis {...axis} width={64} domain={["dataMin - 500", "dataMax + 500"]} tickFormatter={(v) => `$${(v / 1000).toFixed(0)}k`} />
          <Tooltip content={<TooltipBox />} />
          <Area type="monotone" dataKey="value" name="Equity" stroke={color} strokeWidth={2.2} fill="url(#eq-fill)" />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

export function StockChart({ data, height = 320 }: { data: { date: string; close: number; sma20: number | null; sma50: number | null; volume: number }[]; height?: number }) {
  const up = (data.at(-1)?.close ?? 0) >= (data[0]?.close ?? 0);
  const color = up ? "var(--success)" : "var(--destructive)";
  const maxVol = Math.max(...data.map((d) => d.volume));
  return (
    <div style={{ height }}>
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart data={data} margin={{ top: 8, right: 4, left: 4, bottom: 0 }}>
          <defs>
            <linearGradient id="px-fill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={color} stopOpacity={0.3} />
              <stop offset="100%" stopColor={color} stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid stroke="var(--border)" strokeDasharray="3 6" vertical={false} />
          <XAxis dataKey="date" {...axis} tickFormatter={shortDate} minTickGap={40} />
          <YAxis yAxisId="p" {...axis} width={56} domain={["auto", "auto"]} tickFormatter={(v) => `$${Math.round(v)}`} />
          <YAxis yAxisId="v" hide domain={[0, maxVol * 4]} />
          <Tooltip content={<TooltipBox />} />
          <Bar yAxisId="v" dataKey="volume" name="Volume" fill="var(--primary)" opacity={0.25} radius={[2, 2, 0, 0]} />
          <Area yAxisId="p" type="monotone" dataKey="close" name="Close" stroke={color} strokeWidth={2.2} fill="url(#px-fill)" />
          <Line yAxisId="p" type="monotone" dataKey="sma20" name="SMA 20" stroke="var(--primary)" strokeWidth={1.5} dot={false} connectNulls />
          <Line yAxisId="p" type="monotone" dataKey="sma50" name="SMA 50" stroke="var(--ai)" strokeWidth={1.5} dot={false} strokeDasharray="4 4" connectNulls />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}

export function Sparkline({ values, height = 36 }: { values: number[]; height?: number }) {
  const first = values[0] ?? 0;
  const up = (values.at(-1) ?? 0) >= first;
  const data = values.map((v, i) => ({ i, v }));
  const color = up ? "var(--success)" : "var(--destructive)";
  const id = `sp-${Math.round(first * 100)}-${values.length}-${up ? 1 : 0}`;
  return (
    <div style={{ height }} className="w-full">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 2, right: 0, left: 0, bottom: 2 }}>
          <defs>
            <linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={color} stopOpacity={0.3} />
              <stop offset="100%" stopColor={color} stopOpacity={0} />
            </linearGradient>
          </defs>
          <YAxis hide domain={["dataMin", "dataMax"]} />
          <Area type="monotone" dataKey="v" stroke={color} strokeWidth={1.6} fill={`url(#${id})`} isAnimationActive={false} />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
