import { createFileRoute, Link } from "@tanstack/react-router";
import { Activity, Banknote, BarChart3, Bot, Percent, Repeat, Wallet } from "lucide-react";
import { useMemo } from "react";
import { AgentRunPanel } from "@/components/agent-run-panel";
import { Delta, PageHeader, Panel, SimTag, StatCard } from "@/components/page-header";
import { EquityChart, Sparkline } from "@/components/price-chart";
import { StatusBadge } from "@/components/trade-detail-dialog";
import { dateTime, pct, signedUsd, usd } from "@/lib/format";
import { dayChange, equityCurve, STOCKS } from "@/lib/trading/market-data";
import { STARTING_CAPITAL, useTrading } from "@/lib/trading/store";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Overview — TradePilot AI" },
      { name: "description", content: "Simulated portfolio, AI agent status and one-click AI analysis for the TradePilot AI paper-trading demo." },
      { property: "og:title", content: "Overview — TradePilot AI" },
      { property: "og:description", content: "Intelligent Trading. Controlled Risk. Simulated Execution." },
    ],
  }),
  component: Overview,
});

function Overview() {
  const t = useTrading();
  const curve = useMemo(() => equityCurve(t.equity), [t.equity]);
  const pnlPct = (t.totalPnl / STARTING_CAPITAL) * 100;

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Overview"
        title="Intelligent Trading. Controlled Risk. Simulated Execution."
        description="Your AI trading agent's command center. Every number below comes from a virtual $100,000 paper portfolio and synthetic demo prices."
        actions={
          <>
            <SimTag>Paper trading only</SimTag>
          </>
        }
      />

      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-5">
        <StatCard label="Portfolio value" icon={<Wallet />} value={usd(t.equity, 0)} sub={<span>Simulated · started at {usd(STARTING_CAPITAL, 0)}</span>} />
        <StatCard label="Virtual cash" icon={<Banknote />} value={usd(t.cash, 0)} sub={`${((t.cash / t.equity) * 100).toFixed(0)}% of portfolio`} />
        <StatCard label="Total simulated P&L" icon={<BarChart3 />} tone={t.totalPnl >= 0 ? "up" : "down"} value={signedUsd(t.totalPnl, 0)} sub={pct(pnlPct)} />
        <StatCard label="Simulated trades" icon={<Repeat />} value={t.tradeCount} sub={`${t.positions.length} open position(s)`} />
        <StatCard label="Win rate" icon={<Percent />} tone="ai" value={`${t.winRate.toFixed(0)}%`} sub="Closed simulated trades" />
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Panel className="lg:col-span-2" title="Portfolio performance" subtitle="Simulated equity · last 60 demo sessions" action={<Delta value={pnlPct} />}>
          <EquityChart data={curve} />
        </Panel>
        <Panel title={<span className="flex items-center gap-2"><Bot className="size-4 text-ai" /> AI Agent Status</span>} subtitle="Runtime configuration">
          <ul className="space-y-2.5 text-sm">
            {[
              ["Market data", "Demo data", "warning"],
              ["Strategy engine", "Active", "success"],
              ["Risk management", t.killSwitch ? "Paused (kill switch)" : "Active", t.killSwitch ? "danger" : "success"],
              ["Execution mode", "Paper trading", "info"],
              ["Real-money trading", "Disabled", "danger"],
            ].map(([k, v, tone]) => (
              <li key={k} className="flex items-center justify-between rounded-lg border bg-surface/50 px-3 py-2">
                <span className="text-muted-foreground">{k}</span>
                <span className={`flex items-center gap-1.5 font-semibold ${tone === "success" ? "text-success" : tone === "danger" ? "text-destructive" : tone === "warning" ? "text-warning" : "text-primary"}`}>
                  <span className={`size-1.5 rounded-full ${tone === "success" ? "bg-success" : tone === "danger" ? "bg-destructive" : tone === "warning" ? "bg-warning" : "bg-primary"}`} />
                  {v}
                </span>
              </li>
            ))}
          </ul>
          <div className="mt-3 flex items-center gap-2 rounded-lg border border-ai/30 bg-ai/8 px-3 py-2 text-xs text-ai">
            <Activity className="size-3.5" /> Agent heartbeat OK · {t.positions.length} positions monitored
          </div>
        </Panel>
      </div>

      <AgentRunPanel />

      <div className="grid gap-4 lg:grid-cols-5">
        <Panel className="lg:col-span-3" title="Recent trades" subtitle="Latest simulated journal entries" action={<Link to="/journal" className="text-xs font-semibold text-primary hover:underline">View journal →</Link>}>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs text-muted-foreground">
                  <th className="pb-2 font-medium">Trade</th>
                  <th className="pb-2 font-medium">Symbol</th>
                  <th className="pb-2 text-right font-medium">Qty</th>
                  <th className="pb-2 text-right font-medium">Entry</th>
                  <th className="pb-2 text-right font-medium">P&L</th>
                  <th className="pb-2 text-right font-medium">Status</th>
                </tr>
              </thead>
              <tbody>
                {t.journal.slice(0, 6).map((j) => (
                  <tr key={j.id} className="border-t">
                    <td className="py-2.5">
                      <div className="num text-xs font-semibold">{j.id}</div>
                      <div className="text-[11px] text-muted-foreground">{dateTime(j.timestamp)}</div>
                    </td>
                    <td className="py-2.5 font-semibold">{j.symbol}</td>
                    <td className="num py-2.5 text-right">{j.qty}</td>
                    <td className="num py-2.5 text-right">{usd(j.entryPrice)}</td>
                    <td className={`num py-2.5 text-right ${j.pnl === null ? "text-muted-foreground" : j.pnl >= 0 ? "text-success" : "text-destructive"}`}>{j.pnl === null ? "—" : signedUsd(j.pnl, 0)}</td>
                    <td className="py-2.5 text-right">
                      <StatusBadge entry={j} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Panel>
        <Panel className="lg:col-span-2" title="Market overview" subtitle={<span>Demo prices · not live</span>} action={<Link to="/market" className="text-xs font-semibold text-primary hover:underline">Analyze →</Link>}>
          <ul className="divide-y">
            {STOCKS.slice(0, 6).map((s) => {
              const ch = dayChange(s.symbol);
              const last = s.history.at(-1)?.close;
              return (
                <li key={s.symbol} className="flex items-center gap-3 py-2">
                  <div className="w-16">
                    <div className="text-sm font-semibold">{s.symbol}</div>
                    <div className="truncate text-[11px] text-muted-foreground">{s.sector}</div>
                  </div>
                  <div className="flex-1">
                    <Sparkline values={s.history.slice(-30).map((p) => p.close)} height={30} />
                  </div>
                  <div className="w-24 text-right">
                    <div className="num text-sm font-semibold">{usd(last)}</div>
                    <div className="text-[11px]">
                      <Delta value={ch.pct} />
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        </Panel>
      </div>
    </div>
  );
}
