import { createFileRoute, Link } from "@tanstack/react-router";
import { BrainCircuit, Search, Sparkles } from "lucide-react";
import { useMemo, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Delta, PageHeader, Panel, SimTag } from "@/components/page-header";
import { StockChart } from "@/components/price-chart";
import { compact, pct, shortDate, usd } from "@/lib/format";
import { analyzeMarket, computeIndicators, smaSeries, type MarketAnalysis } from "@/lib/trading/indicators";
import { DEMO_AS_OF, dayChange, getStock, STOCKS } from "@/lib/trading/market-data";
import { STRATEGY_NAMES } from "@/lib/trading/types";

export const Route = createFileRoute("/market")({
  head: () => ({
    meta: [
      { title: "Market Analysis — TradePilot AI" },
      { name: "description", content: "Searchable demo stock list, price charts, technical indicators and simulated AI market analysis." },
      { property: "og:title", content: "Market Analysis — TradePilot AI" },
      { property: "og:description", content: "Demo market data with technical indicators and a simulated AI market read." },
    ],
  }),
  component: MarketPage,
});

const RANGES = [30, 60, 120] as const;

function MarketPage() {
  const [query, setQuery] = useState("");
  const [symbol, setSymbol] = useState("AAPL");
  const [range, setRange] = useState<(typeof RANGES)[number]>(60);
  const [analysis, setAnalysis] = useState<{ symbol: string; result: MarketAnalysis } | null>(null);
  const [thinking, setThinking] = useState(false);

  const stock = getStock(symbol);
  const ind = useMemo(() => computeIndicators(stock.history), [stock]);
  const change = dayChange(symbol);
  const trend = useMemo(() => analyzeMarket(ind).trend, [ind]);

  const chartData = useMemo(() => {
    const closes = stock.history.map((p) => p.close);
    const s20 = smaSeries(closes, 20);
    const s50 = smaSeries(closes, 50);
    return stock.history.map((p, i) => ({ ...p, sma20: s20[i] ?? null, sma50: s50[i] ?? null })).slice(-range);
  }, [stock, range]);

  const filtered = STOCKS.filter((s) => (s.symbol + s.name + s.sector).toLowerCase().includes(query.toLowerCase()));

  const runAnalysis = () => {
    setThinking(true);
    setAnalysis(null);
    setTimeout(() => {
      setAnalysis({ symbol, result: analyzeMarket(ind) });
      setThinking(false);
    }, 1100);
  };

  const shownAnalysis = analysis?.symbol === symbol ? analysis.result : null;

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Market Analysis"
        title="Demo market explorer"
        description={`Synthetic prices generated for this demo, as of ${shortDate(DEMO_AS_OF)}. They do not represent live or historical market conditions.`}
        actions={<SimTag>Demo data</SimTag>}
      />

      <div className="grid gap-4 lg:grid-cols-[300px_1fr]">
        <Panel title="Watchlist" subtitle={`${STOCKS.length} demo symbols`}>
          <div className="relative mb-3">
            <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search symbol or name" className="pl-9" aria-label="Search stocks" />
          </div>
          <ul className="space-y-1">
            {filtered.map((s) => {
              const ch = dayChange(s.symbol);
              const active = s.symbol === symbol;
              return (
                <li key={s.symbol}>
                  <button onClick={() => setSymbol(s.symbol)} className={`flex w-full items-center justify-between rounded-lg px-3 py-2.5 text-left transition-colors ${active ? "bg-primary/12 ring-1 ring-primary/40" : "hover:bg-accent"}`}>
                    <div>
                      <div className="text-sm font-semibold">{s.symbol}</div>
                      <div className="text-[11px] text-muted-foreground">{s.name}</div>
                    </div>
                    <div className="text-right">
                      <div className="num text-sm font-medium">{usd(s.history.at(-1)?.close)}</div>
                      <div className="text-[11px]">
                        <Delta value={ch.pct} />
                      </div>
                    </div>
                  </button>
                </li>
              );
            })}
            {filtered.length === 0 && <li className="px-3 py-6 text-center text-sm text-muted-foreground">No demo stock matches “{query}”.</li>}
          </ul>
        </Panel>

        <div className="space-y-4">
          <Panel>
            <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-2xl font-semibold">{stock.symbol}</h2>
                  <span className="text-sm text-muted-foreground">{stock.name}</span>
                  <Badge variant={trend === "Uptrend" ? "success" : trend === "Downtrend" ? "danger" : "muted"}>{trend}</Badge>
                </div>
                <div className="mt-1 flex items-baseline gap-3">
                  <span className="num text-3xl font-semibold">{usd(ind.price)}</span>
                  <span className={`num text-sm ${change.abs >= 0 ? "text-success" : "text-destructive"}`}>
                    {change.abs >= 0 ? "+" : "−"}
                    {Math.abs(change.abs).toFixed(2)} ({pct(change.pct)})
                  </span>
                  <SimTag>Demo price</SimTag>
                </div>
              </div>
              <div className="inline-flex rounded-lg border bg-background/50 p-1">
                {RANGES.map((r) => (
                  <button key={r} onClick={() => setRange(r)} className={`rounded-md px-3 py-1 text-xs font-semibold ${range === r ? "bg-secondary text-foreground" : "text-muted-foreground hover:text-foreground"}`}>
                    {r}D
                  </button>
                ))}
              </div>
            </div>
            <div className="mt-4">
              <StockChart data={chartData} />
            </div>
            <div className="mt-2 flex flex-wrap gap-4 text-xs text-muted-foreground">
              <span className="flex items-center gap-1.5"><span className="h-0.5 w-4 bg-primary" /> SMA 20</span>
              <span className="flex items-center gap-1.5"><span className="h-0.5 w-4 bg-ai" /> SMA 50</span>
              <span className="flex items-center gap-1.5"><span className="size-2 rounded-sm bg-primary/30" /> Volume</span>
            </div>
          </Panel>

          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            {[
              ["SMA 20", usd(ind.sma20)],
              ["SMA 50", usd(ind.sma50)],
              ["RSI (14)", ind.rsi14.toFixed(1)],
              ["ATR (14)", usd(ind.atr14)],
              ["Volatility (ann.)", `${ind.vol20.toFixed(1)}%`],
              ["Z-score (20)", ind.z20.toFixed(2)],
              ["Avg volume (20D)", compact(ind.avgVolume)],
              ["30-day change", pct(ind.change30Pct)],
            ].map(([k, v]) => (
              <div key={k} className="panel p-3">
                <div className="text-[11px] text-muted-foreground">{k}</div>
                <div className="num mt-1 text-lg font-semibold">{v}</div>
              </div>
            ))}
          </div>

          <section className="panel-hero p-5">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <div className="flex items-center gap-2">
                  <Badge variant="ai"><BrainCircuit className="mr-1 size-3.5" /> Simulated AI analysis</Badge>
                </div>
                <h3 className="mt-2 text-lg font-semibold">What does the agent see in {symbol}?</h3>
              </div>
              <Button variant="ai" onClick={runAnalysis} disabled={thinking}>
                <Sparkles className={thinking ? "animate-spin" : ""} /> {thinking ? "Analyzing demo data…" : "Analyze with AI"}
              </Button>
            </div>
            {thinking && (
              <div className="mt-4 grid gap-2 sm:grid-cols-3">
                {[0, 1, 2].map((i) => <div key={i} className="h-16 animate-pulse rounded-xl bg-muted/50" />)}
              </div>
            )}
            {shownAnalysis && (
              <div className="mt-4 space-y-3 animate-in fade-in slide-in-from-bottom-2">
                <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-5">
                  {[
                    ["Market trend", shownAnalysis.trend],
                    ["Current condition", shownAnalysis.condition],
                    ["Possible opportunity", shownAnalysis.opportunity],
                    ["Selected strategy", STRATEGY_NAMES[shownAnalysis.strategy]],
                    ["Risk level", shownAnalysis.riskLevel],
                  ].map(([k, v]) => (
                    <div key={k} className="rounded-xl border bg-background/50 p-3">
                      <div className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{k}</div>
                      <div className={`mt-1 text-sm font-semibold ${k === "Risk level" ? (v === "High" ? "text-destructive" : v === "Moderate" ? "text-warning" : "text-success") : ""}`}>{v}</div>
                    </div>
                  ))}
                </div>
                <div className="rounded-xl border border-ai/30 bg-ai/8 p-3 text-sm">
                  <span className="font-semibold text-ai">Agent explanation: </span>
                  {shownAnalysis.explanation}
                </div>
                <p className="text-xs text-muted-foreground">Based only on synthetic demo data. Not a description of live market conditions and not financial advice.</p>
                <Link to="/strategy-lab" className="inline-flex text-sm font-semibold text-primary hover:underline">Test this in the AI Strategy Lab →</Link>
              </div>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}
