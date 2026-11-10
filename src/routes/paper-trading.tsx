import { createFileRoute, Link } from "@tanstack/react-router";
import { OctagonPause, ShieldAlert } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { PageHeader, Panel, StatCard } from "@/components/page-header";
import { DecisionBanner, RiskChecksList } from "@/components/risk-checks";
import { dateTime, signedUsd, usd } from "@/lib/format";
import { isDemoSymbol, priceOf, STOCKS } from "@/lib/trading/market-data";
import { useTrading } from "@/lib/trading/store";
import { STRATEGY_NAMES, type RiskEvaluation, type StrategyId } from "@/lib/trading/types";

export const Route = createFileRoute("/paper-trading")({
  head: () => ({
    meta: [
      { title: "Paper Trading — TradePilot AI" },
      { name: "description", content: "Place simulated buy and sell orders with virtual cash. Every order is checked by the Risk Governor. Paper trading only." },
      { property: "og:title", content: "Paper Trading — TradePilot AI" },
      { property: "og:description", content: "Simulated order ticket with virtual cash, positions and risk checks." },
    ],
  }),
  component: PaperTrading,
});

function PaperTrading() {
  const t = useTrading();
  const [side, setSide] = useState<"BUY" | "SELL">("BUY");
  const [symbol, setSymbol] = useState("AAPL");
  const [qty, setQty] = useState("10");
  const [entry, setEntry] = useState(String(priceOf("AAPL")));
  const [stop, setStop] = useState(String(Math.round(priceOf("AAPL") * 0.96 * 100) / 100));
  const [tp, setTp] = useState(String(Math.round(priceOf("AAPL") * 1.08 * 100) / 100));
  const [strategy, setStrategy] = useState<StrategyId>("manual");
  const [result, setResult] = useState<RiskEvaluation | null>(null);
  const [errors, setErrors] = useState<string[]>([]);

  const applySymbol = (s: string) => {
    // The dropdown can report an empty value (e.g. on form reset); ignore anything that isn't a demo stock.
    if (!isDemoSymbol(s)) return;
    setSymbol(s);
    const p = priceOf(s);
    setEntry(String(p));
    setStop(String(Math.round(p * 0.96 * 100) / 100));
    setTp(String(Math.round(p * 1.08 * 100) / 100));
  };

  // Consume an order drafted in the Strategy Lab.
  useEffect(() => {
    if (!t.draft) return;
    setSide("BUY");
    setSymbol(t.draft.symbol);
    setEntry(String(t.draft.entryPrice));
    setStop(String(t.draft.stopLoss));
    setTp(String(t.draft.takeProfit));
    setStrategy(t.draft.strategy);
    const perShare = Math.max(t.draft.entryPrice - t.draft.stopLoss, 0.01);
    setQty(String(Math.max(1, Math.min(Math.floor((t.equity * 0.01) / perShare), Math.floor((t.equity * 0.2) / t.draft.entryPrice)))));
    toast.info(`Ticket pre-filled from Strategy Lab: ${t.draft.symbol}`);
    t.setDraft(null);
  }, [t.draft]); // eslint-disable-line react-hooks/exhaustive-deps

  const held = t.positions.filter((p) => p.symbol === symbol).reduce((a, p) => a + p.qty, 0);
  const nQty = Number(qty);
  const nEntry = Number(entry);
  const nStop = stop.trim() === "" ? null : Number(stop);
  const nTp = tp.trim() === "" ? null : Number(tp);
  const cost = (Number.isFinite(nQty) ? nQty : 0) * (Number.isFinite(nEntry) ? nEntry : 0);
  const atRisk = nStop !== null && nStop < nEntry ? (nEntry - nStop) * nQty : null;

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const errs: string[] = [];
    if (!Number.isInteger(nQty) || nQty <= 0) errs.push("Quantity must be a whole number greater than 0.");
    if (!Number.isFinite(nEntry) || nEntry <= 0) errs.push("Entry price must be a positive number.");
    if (side === "BUY" && nStop !== null && (!Number.isFinite(nStop) || nStop <= 0)) errs.push("Stop-loss must be a positive number.");
    if (side === "BUY" && nTp !== null && (!Number.isFinite(nTp) || nTp <= nEntry)) errs.push("Take-profit must be above the entry price.");
    setErrors(errs);
    if (errs.length) {
      setResult(null);
      return;
    }
    const { evaluation } = t.submitTrade(
      { symbol, side, qty: nQty, entryPrice: nEntry, stopLoss: side === "BUY" ? nStop : null, takeProfit: side === "BUY" ? nTp : null, strategy },
      { source: "Manual", aiExplanation: strategy === "manual" ? "Manual order placed by the user on the paper-trading ticket." : `Order drafted from the ${STRATEGY_NAMES[strategy]} signal in the AI Strategy Lab.` },
    );
    setResult(evaluation);
    if (evaluation.approved) toast.success(`Paper ${side} executed: ${nQty} ${symbol}`, { description: "Simulated — no real order sent." });
    else toast.error("Order rejected", { description: evaluation.explanation });
  };

  const history = useMemo(() => t.journal.filter((j) => j.status !== "Open").slice(0, 8), [t.journal]);

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Paper Trading"
        title="Simulated order desk"
        description="Trade with virtual cash against demo prices. Orders never leave your browser — there is no broker connection."
        actions={
          <span className="inline-flex items-center gap-2 rounded-lg border-2 border-warning/60 bg-warning/10 px-3 py-1.5 text-sm font-bold tracking-wider text-warning">
            <ShieldAlert className="size-4" /> PAPER TRADING ONLY
          </span>
        }
      />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label="Virtual cash" value={usd(t.cash, 0)} sub="Available to trade" />
        <StatCard label="Portfolio value" value={usd(t.equity, 0)} sub="Simulated" />
        <StatCard label="Invested" value={usd(t.invested, 0)} sub={`${((t.invested / t.equity) * 100).toFixed(0)}% exposure`} />
        <StatCard label="Unrealized P&L" tone={t.unrealizedPnl >= 0 ? "up" : "down"} value={signedUsd(t.unrealizedPnl, 0)} sub="Open positions" />
      </div>

      <div className="grid gap-4 lg:grid-cols-[380px_1fr]">
        <Panel title="Order ticket" subtitle="Validated by the Risk Governor">
          {t.killSwitch ? (
            <div className="rounded-xl border border-destructive/40 bg-destructive/10 p-4 text-sm">
              <div className="flex items-center gap-2 font-semibold text-destructive"><OctagonPause className="size-4" /> Trading paused</div>
              <p className="mt-1 text-muted-foreground">The kill switch is active, so new simulated trades are disabled.</p>
              <Button asChild variant="outline" size="sm" className="mt-3"><Link to="/risk">Go to Risk Management to resume</Link></Button>
            </div>
          ) : (
            <form onSubmit={submit} className="space-y-3.5" noValidate>
              <div className="grid grid-cols-2 gap-1 rounded-xl border bg-background/50 p-1">
                {(["BUY", "SELL"] as const).map((s) => (
                  <button type="button" key={s} onClick={() => setSide(s)} className={`rounded-lg py-2 text-sm font-bold transition-colors ${side === s ? (s === "BUY" ? "bg-success text-success-foreground" : "bg-destructive text-destructive-foreground") : "text-muted-foreground hover:text-foreground"}`}>
                    {s === "BUY" ? "Buy" : "Sell"}
                  </button>
                ))}
              </div>
              <div className="space-y-1.5">
                <Label>Stock</Label>
                <Select value={symbol} onValueChange={applySymbol}>
                  <SelectTrigger aria-label="Stock"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {STOCKS.map((s) => (
                      <SelectItem key={s.symbol} value={s.symbol}>{s.symbol} · {usd(priceOf(s.symbol))}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-[11px] text-muted-foreground">Holding {held} share(s) · demo price {usd(priceOf(symbol))}</p>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <Field id="qty" label="Quantity" value={qty} onChange={setQty} step="1" />
                <Field id="entry" label="Simulated entry price" value={entry} onChange={setEntry} />
              </div>
              {side === "BUY" && (
                <div className="grid grid-cols-2 gap-3">
                  <Field id="stop" label="Stop-loss" value={stop} onChange={setStop} placeholder="Required" />
                  <Field id="tp" label="Take-profit" value={tp} onChange={setTp} placeholder="Optional" />
                </div>
              )}
              <div className="space-y-1 rounded-lg border bg-surface/50 p-3 text-sm">
                <Row k={side === "BUY" ? "Estimated cost" : "Estimated proceeds"} v={usd(cost)} />
                {side === "BUY" && <Row k="Capital at risk" v={atRisk !== null ? usd(atRisk) : "No valid stop"} tone={atRisk === null ? "text-destructive" : ""} />}
                <Row k="Strategy" v={STRATEGY_NAMES[strategy]} />
              </div>
              {errors.length > 0 && (
                <ul className="space-y-1 rounded-lg border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
                  {errors.map((e) => <li key={e}>• {e}</li>)}
                </ul>
              )}
              <Button type="submit" variant={side === "BUY" ? "success" : "sell"} className="w-full" size="lg">
                Submit simulated {side === "BUY" ? "buy" : "sell"}
              </Button>
            </form>
          )}
          {result && (
            <div className="mt-4 space-y-3 animate-in fade-in">
              <DecisionBanner evaluation={result} />
              <RiskChecksList checks={result.checks} compact />
            </div>
          )}
        </Panel>

        <div className="space-y-4">
          <Panel title="Open simulated positions" subtitle="Marked to demo prices">
            {t.positions.length === 0 ? (
              <p className="py-8 text-center text-sm text-muted-foreground">No open positions. Submit a simulated buy to open one.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-xs text-muted-foreground">
                      <th className="pb-2 font-medium">Symbol</th>
                      <th className="pb-2 text-right font-medium">Qty</th>
                      <th className="pb-2 text-right font-medium">Entry</th>
                      <th className="pb-2 text-right font-medium">Price</th>
                      <th className="pb-2 text-right font-medium">Stop / Target</th>
                      <th className="pb-2 text-right font-medium">P&L</th>
                      <th className="pb-2" />
                    </tr>
                  </thead>
                  <tbody>
                    {t.positions.map((p) => {
                      const price = priceOf(p.symbol);
                      const pnl = (price - p.entryPrice) * p.qty;
                      return (
                        <tr key={p.id} className="border-t">
                          <td className="py-2.5">
                            <div className="font-semibold">{p.symbol}</div>
                            <div className="num text-[11px] text-muted-foreground">{p.id}</div>
                          </td>
                          <td className="num py-2.5 text-right">{p.qty}</td>
                          <td className="num py-2.5 text-right">{usd(p.entryPrice)}</td>
                          <td className="num py-2.5 text-right">{usd(price)}</td>
                          <td className="num py-2.5 text-right text-xs text-muted-foreground">{p.stopLoss ? usd(p.stopLoss) : "—"} / {p.takeProfit ? usd(p.takeProfit) : "—"}</td>
                          <td className={`num py-2.5 text-right font-semibold ${pnl >= 0 ? "text-success" : "text-destructive"}`}>{signedUsd(pnl, 0)}</td>
                          <td className="py-2.5 pl-2 text-right">
                            <Button
                              size="sm"
                              variant="outline"
                              disabled={t.killSwitch}
                              onClick={() => {
                                const ev = t.closePosition(p.id);
                                setResult(ev);
                                if (ev.approved) toast.success(`Closed ${p.qty} ${p.symbol}`, { description: `Simulated P&L ${signedUsd(pnl)}` });
                                else toast.error("Close rejected", { description: ev.explanation });
                              }}
                            >
                              Close
                            </Button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </Panel>

          <Panel title="Trade history" subtitle="Closed and rejected simulated trades" action={<Link to="/journal" className="text-xs font-semibold text-primary hover:underline">Full journal →</Link>}>
            <ul className="divide-y">
              {history.map((j) => (
                <li key={j.id} className="flex items-center gap-3 py-2.5 text-sm">
                  <Badge variant={j.status === "Rejected" ? "danger" : "muted"}>{j.status}</Badge>
                  <div className="min-w-0 flex-1">
                    <div className="font-semibold">{j.side} {j.qty} {j.symbol} <span className="num font-normal text-muted-foreground">@ {usd(j.entryPrice)}</span></div>
                    <div className="truncate text-[11px] text-muted-foreground">{j.status === "Rejected" ? j.riskResult : dateTime(j.closedAt ?? j.timestamp)}</div>
                  </div>
                  <div className={`num font-semibold ${j.pnl === null ? "text-muted-foreground" : j.pnl >= 0 ? "text-success" : "text-destructive"}`}>{j.pnl === null ? "—" : signedUsd(j.pnl, 0)}</div>
                </li>
              ))}
            </ul>
          </Panel>
        </div>
      </div>
    </div>
  );
}

function Field({ id, label, value, onChange, placeholder, step = "0.01" }: { id: string; label: string; value: string; onChange: (v: string) => void; placeholder?: string; step?: string }) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id} className="text-xs">{label}</Label>
      <Input id={id} type="number" inputMode="decimal" step={step} value={value} placeholder={placeholder} onChange={(e) => onChange(e.target.value)} className="num" />
    </div>
  );
}

function Row({ k, v, tone = "" }: { k: string; v: string; tone?: string }) {
  return (
    <div className="flex justify-between gap-2">
      <span className="text-muted-foreground">{k}</span>
      <span className={`num font-medium ${tone}`}>{v}</span>
    </div>
  );
}
