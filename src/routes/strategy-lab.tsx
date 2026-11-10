import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { ArrowRight, CheckCircle2, FlaskConical, Play, Sparkles } from "lucide-react";
import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { PageHeader, Panel, SimTag } from "@/components/page-header";
import { Sparkline } from "@/components/price-chart";
import { usd } from "@/lib/format";
import { STOCKS } from "@/lib/trading/market-data";
import { runStrategy, STRATEGIES, type StrategySignal } from "@/lib/trading/strategies";
import { useTrading } from "@/lib/trading/store";

export const Route = createFileRoute("/strategy-lab")({
  head: () => ({
    meta: [
      { title: "AI Strategy Lab — TradePilot AI" },
      { name: "description", content: "Compare trend following and mean reversion, then run a simulated strategy analysis with entry, stop-loss and take-profit." },
      { property: "og:title", content: "AI Strategy Lab — TradePilot AI" },
      { property: "og:description", content: "Select a strategy and generate a simulated trading signal on demo data." },
    ],
  }),
  component: StrategyLab,
});

type SId = (typeof STRATEGIES)[number]["id"];

function StrategyLab() {
  const [selected, setSelected] = useState<SId>("trend");
  const [symbol, setSymbol] = useState("NVDA");
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState<{ id: SId; symbol: string; signal: StrategySignal } | null>(null);
  const { setDraft } = useTrading();
  const navigate = useNavigate();

  const run = () => {
    setRunning(true);
    setResult(null);
    setTimeout(() => {
      setResult({ id: selected, symbol, signal: runStrategy(selected, symbol) });
      setRunning(false);
    }, 1200);
  };

  const sendToTicket = () => {
    if (!result) return;
    setDraft({ symbol: result.symbol, entryPrice: result.signal.entry, stopLoss: result.signal.stopLoss, takeProfit: result.signal.takeProfit, strategy: result.id });
    navigate({ to: "/paper-trading" });
  };

  const strat = STRATEGIES.find((s) => s.id === selected)!;

  return (
    <div className="space-y-6">
      <PageHeader eyebrow="AI Strategy Lab" title="Choose the agent's playbook" description="Two rule-based strategies the agent can deploy. Sample performance is illustrative backtest-style demo data." actions={<SimTag>Sample performance</SimTag>} />

      <div className="grid gap-4 md:grid-cols-2" role="radiogroup" aria-label="Strategy">
        {STRATEGIES.map((s) => {
          const active = s.id === selected;
          return (
            <button
              key={s.id}
              role="radio"
              aria-checked={active}
              onClick={() => setSelected(s.id)}
              className={`panel group p-5 text-left transition-all ${active ? "ring-2 ring-ai/70 shadow-glow" : "hover:ring-1 hover:ring-border"}`}
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h2 className="text-lg font-semibold">{s.name}</h2>
                  <p className="mt-1 text-sm text-muted-foreground">{s.description}</p>
                </div>
                {active ? <Badge variant="ai"><CheckCircle2 className="mr-1 size-3.5" /> Selected</Badge> : <Badge variant="muted">Standby</Badge>}
              </div>
              <div className="mt-4">
                <div className="mb-1.5 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Useful when</div>
                <div className="flex flex-wrap gap-1.5">
                  {s.usefulWhen.map((u) => (
                    <span key={u} className="rounded-full border bg-surface/60 px-2.5 py-0.5 text-xs">{u}</span>
                  ))}
                </div>
              </div>
              <div className="mt-4 grid grid-cols-4 gap-2">
                {[
                  ["Win rate", `${s.sample.winRate}%`, ""],
                  ["Avg return", `+${s.sample.avgReturn}%`, "text-success"],
                  ["Trades", String(s.sample.trades), ""],
                  ["Max DD", `${s.sample.maxDrawdown}%`, "text-destructive"],
                ].map(([k, v, c]) => (
                  <div key={k} className="rounded-lg border bg-background/40 p-2">
                    <div className="text-[10px] text-muted-foreground">{k}</div>
                    <div className={`num text-sm font-semibold ${c}`}>{v}</div>
                  </div>
                ))}
              </div>
              <div className="mt-3 flex items-end justify-between gap-3">
                <div className="flex-1"><Sparkline values={s.curve} height={44} /></div>
                <div className="text-right text-xs">
                  <div className="text-muted-foreground">Risk level</div>
                  <div className={`font-semibold ${s.riskLevel === "Low" ? "text-success" : "text-warning"}`}>{s.riskLevel}</div>
                </div>
              </div>
            </button>
          );
        })}
      </div>

      <Panel title={<span className="flex items-center gap-2"><FlaskConical className="size-4 text-ai" /> Run strategy analysis</span>} subtitle={`Strategy: ${strat.name}`}>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <Select value={symbol} onValueChange={setSymbol}>
            <SelectTrigger className="sm:w-56" aria-label="Demo stock">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {STOCKS.map((s) => (
                <SelectItem key={s.symbol} value={s.symbol}>
                  {s.symbol} — {s.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button variant="ai" onClick={run} disabled={running}>
            {running ? <Sparkles className="animate-spin" /> : <Play />} {running ? "Analyzing sample data…" : "Run Strategy Analysis"}
          </Button>
        </div>

        {running && <div className="mt-5 h-40 animate-pulse rounded-xl bg-muted/50" />}

        {result && (
          <div className="mt-5 grid gap-4 animate-in fade-in slide-in-from-bottom-2 lg:grid-cols-[260px_1fr]">
            <div className="rounded-xl border bg-surface/60 p-4 text-center">
              <div className="text-xs text-muted-foreground">{result.symbol} · {STRATEGIES.find((s) => s.id === result.id)?.short}</div>
              <div className={`font-display mt-2 text-4xl font-bold ${result.signal.signal === "BUY" ? "text-success" : result.signal.signal === "SELL" ? "text-destructive" : "text-warning"}`}>{result.signal.signal}</div>
              <ConfidenceRing value={result.signal.confidence} />
              <p className="mt-2 text-[11px] text-muted-foreground">Simulated confidence score — a model output for demo purposes, not a guarantee of accuracy or profit.</p>
            </div>
            <div className="space-y-3">
              <div className="rounded-xl border border-ai/30 bg-ai/8 p-3 text-sm">
                <span className="font-semibold text-ai">Why this signal: </span>
                {result.signal.explanation}
              </div>
              <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
                <Metric k="Proposed entry" v={usd(result.signal.entry)} />
                <Metric k="Stop-loss" v={usd(result.signal.stopLoss)} tone="text-destructive" />
                <Metric k="Take-profit" v={usd(result.signal.takeProfit)} tone="text-success" />
                <Metric k="Reward : risk" v={`${((result.signal.takeProfit - result.signal.entry) / Math.max(result.signal.entry - result.signal.stopLoss, 0.01)).toFixed(1)} : 1`} />
              </div>
              <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
                {result.signal.facts.map((f) => <Metric key={f.label} k={f.label} v={f.value} />)}
              </div>
              {result.signal.signal === "BUY" ? (
                <Button onClick={sendToTicket}>
                  Send to paper trading ticket <ArrowRight />
                </Button>
              ) : (
                <p className="text-sm text-muted-foreground">No long entry — this demo is long-only. Try another stock or the other strategy.</p>
              )}
            </div>
          </div>
        )}
      </Panel>
    </div>
  );
}

function Metric({ k, v, tone = "" }: { k: string; v: string; tone?: string }) {
  return (
    <div className="rounded-lg border bg-background/40 p-2.5">
      <div className="text-[11px] text-muted-foreground">{k}</div>
      <div className={`num text-sm font-semibold ${tone}`}>{v}</div>
    </div>
  );
}

function ConfidenceRing({ value }: { value: number }) {
  const r = 38;
  const c = 2 * Math.PI * r;
  return (
    <div className="relative mx-auto mt-3 size-28">
      <svg viewBox="0 0 100 100" className="size-full -rotate-90">
        <circle cx="50" cy="50" r={r} fill="none" stroke="var(--muted)" strokeWidth="9" />
        <circle cx="50" cy="50" r={r} fill="none" stroke="var(--ai)" strokeWidth="9" strokeLinecap="round" strokeDasharray={c} strokeDashoffset={c * (1 - value / 100)} className="transition-all duration-700" />
      </svg>
      <div className="absolute inset-0 grid place-items-center">
        <div>
          <div className="num text-2xl font-bold">{value}</div>
          <div className="text-[10px] text-muted-foreground">/ 100 sim.</div>
        </div>
      </div>
    </div>
  );
}
