import { createFileRoute } from "@tanstack/react-router";
import { Search } from "lucide-react";
import { useMemo, useState } from "react";
import { Input } from "@/components/ui/input";
import { PageHeader, Panel, SimTag, StatCard } from "@/components/page-header";
import { StatusBadge, TradeDetailDialog } from "@/components/trade-detail-dialog";
import { dateTime, signedUsd, usd } from "@/lib/format";
import { useTrading } from "@/lib/trading/store";
import { STRATEGY_NAMES, type JournalEntry, type StrategyId } from "@/lib/trading/types";

export const Route = createFileRoute("/journal")({
  head: () => ({
    meta: [
      { title: "Trade Journal — TradePilot AI" },
      { name: "description", content: "Every simulated trade decision with AI explanation, risk check result, and strategy performance summary." },
      { property: "og:title", content: "Trade Journal — TradePilot AI" },
      { property: "og:description", content: "Full audit trail of simulated trades and Risk Governor decisions." },
    ],
  }),
  component: JournalPage,
});

const FILTERS = [
  { id: "all", label: "All" },
  { id: "accepted", label: "Accepted" },
  { id: "rejected", label: "Rejected" },
  { id: "profit", label: "Profitable" },
  { id: "loss", label: "Losing" },
] as const;
type FilterId = (typeof FILTERS)[number]["id"];

const match = (j: JournalEntry, f: FilterId) =>
  f === "all" ? true : f === "accepted" ? j.decision === "Accepted" : f === "rejected" ? j.decision === "Rejected" : f === "profit" ? (j.pnl ?? 0) > 0 : j.pnl !== null && j.pnl < 0;

function JournalPage() {
  const { journal } = useTrading();
  const [filter, setFilter] = useState<FilterId>("all");
  const [q, setQ] = useState("");
  const [open, setOpen] = useState<JournalEntry | null>(null);

  const rows = journal.filter((j) => match(j, filter) && (j.symbol + j.id).toLowerCase().includes(q.toLowerCase()));
  const accepted = journal.filter((j) => j.decision === "Accepted").length;
  const rejected = journal.length - accepted;
  const totalPnl = journal.reduce((a, j) => a + (j.pnl ?? 0), 0);

  const byStrategy = useMemo(() => {
    const ids: StrategyId[] = ["trend", "meanrev", "manual"];
    return ids.map((id) => {
      const list = journal.filter((j) => j.strategy === id);
      const closed = list.filter((j) => j.pnl !== null);
      const wins = closed.filter((j) => (j.pnl as number) > 0).length;
      return { id, trades: list.length, rejected: list.filter((j) => j.decision === "Rejected").length, closed: closed.length, winRate: closed.length ? (wins / closed.length) * 100 : 0, pnl: closed.reduce((a, j) => a + (j.pnl as number), 0) };
    }).filter((s) => s.trades > 0);
  }, [journal]);
  const maxAbs = Math.max(1, ...byStrategy.map((s) => Math.abs(s.pnl)));

  return (
    <div className="space-y-6">
      <PageHeader eyebrow="Trade Journal" title="Decision audit trail" description="Every simulated trade the agent or you proposed — including the ones the Risk Governor blocked." actions={<SimTag>Simulated P&L</SimTag>} />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label="Total simulated trades" value={journal.length} />
        <StatCard label="Accepted" tone="up" value={accepted} />
        <StatCard label="Rejected" tone="down" value={rejected} />
        <StatCard label="Total simulated P&L" tone={totalPnl >= 0 ? "up" : "down"} value={signedUsd(totalPnl, 0)} sub="Realized, closed trades" />
      </div>

      <Panel title="Strategy performance" subtitle="Realized simulated results by strategy">
        <div className="grid gap-3 md:grid-cols-3">
          {byStrategy.map((s) => (
            <div key={s.id} className="rounded-xl border bg-surface/50 p-4">
              <div className="text-sm font-semibold">{STRATEGY_NAMES[s.id]}</div>
              <div className={`num mt-1 text-xl font-semibold ${s.pnl >= 0 ? "text-success" : "text-destructive"}`}>{signedUsd(s.pnl, 0)}</div>
              <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-muted">
                <div className={`h-full rounded-full ${s.pnl >= 0 ? "bg-success" : "bg-destructive"}`} style={{ width: `${(Math.abs(s.pnl) / maxAbs) * 100}%` }} />
              </div>
              <div className="mt-2 flex justify-between text-xs text-muted-foreground">
                <span>{s.trades} trades · {s.rejected} rejected</span>
                <span>Win rate {s.winRate.toFixed(0)}%</span>
              </div>
            </div>
          ))}
        </div>
      </Panel>

      <Panel>
        <div className="mb-4 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div className="flex flex-wrap gap-1.5" role="tablist" aria-label="Filter trades">
            {FILTERS.map((f) => (
              <button key={f.id} role="tab" aria-selected={filter === f.id} onClick={() => setFilter(f.id)} className={`rounded-full border px-3 py-1 text-xs font-semibold transition-colors ${filter === f.id ? "border-primary/50 bg-primary/15 text-primary" : "text-muted-foreground hover:text-foreground"}`}>
                {f.label} <span className="num ml-1 opacity-70">{journal.filter((j) => match(j, f.id)).length}</span>
              </button>
            ))}
          </div>
          <div className="relative md:w-64">
            <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search symbol or ID" className="pl-9" aria-label="Search journal" />
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[900px] text-sm">
            <thead>
              <tr className="text-left text-xs text-muted-foreground">
                {["Trade ID", "Symbol", "Strategy", "Entry", "Exit", "Qty", "Sim. P&L", "Status", "Risk check"].map((h, i) => (
                  <th key={h} className={`pb-2 font-medium ${i >= 3 && i <= 6 ? "text-right" : ""} ${i === 7 ? "pl-4" : ""}`}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((j) => (
                <tr key={j.id} onClick={() => setOpen(j)} className="cursor-pointer border-t transition-colors hover:bg-accent/50">
                  <td className="py-2.5">
                    <div className="num text-xs font-semibold">{j.id}</div>
                    <div className="text-[11px] text-muted-foreground">{dateTime(j.timestamp)}</div>
                  </td>
                  <td className="py-2.5 font-semibold">{j.side === "SELL" ? "SELL " : ""}{j.symbol}</td>
                  <td className="py-2.5 text-xs text-muted-foreground">{STRATEGY_NAMES[j.strategy]}</td>
                  <td className="num py-2.5 text-right">{usd(j.entryPrice)}</td>
                  <td className="num py-2.5 text-right">{j.exitPrice ? usd(j.exitPrice) : "—"}</td>
                  <td className="num py-2.5 text-right">{j.qty}</td>
                  <td className={`num py-2.5 text-right font-semibold ${j.pnl === null ? "text-muted-foreground" : j.pnl >= 0 ? "text-success" : "text-destructive"}`}>{j.pnl === null ? "—" : signedUsd(j.pnl, 0)}</td>
                  <td className="py-2.5 pl-4"><StatusBadge entry={j} /></td>
                  <td className="max-w-[260px] truncate py-2.5 text-xs text-muted-foreground" title={j.riskResult}>{j.riskResult}</td>
                </tr>
              ))}
              {rows.length === 0 && (
                <tr><td colSpan={9} className="py-10 text-center text-muted-foreground">No trades match this filter.</td></tr>
              )}
            </tbody>
          </table>
        </div>
        <p className="mt-3 text-xs text-muted-foreground">Click any row to inspect the AI decision explanation and full risk checks.</p>
      </Panel>

      <TradeDetailDialog entry={open} onOpenChange={(o) => !o && setOpen(null)} />
    </div>
  );
}
