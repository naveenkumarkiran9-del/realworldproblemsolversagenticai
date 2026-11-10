import { createFileRoute } from "@tanstack/react-router";
import { OctagonPause, PlayCircle, ShieldCheck } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { PageHeader, Panel } from "@/components/page-header";
import { DecisionBanner, RiskChecksList } from "@/components/risk-checks";
import { dateTime, usd } from "@/lib/format";
import { DEFAULT_LIMITS } from "@/lib/trading/risk";
import { planAgentRun } from "@/lib/trading/scenarios";
import { useTrading } from "@/lib/trading/store";
import type { ProposedTrade, RiskEvaluation, RiskLimits } from "@/lib/trading/types";

export const Route = createFileRoute("/risk")({
  head: () => ({
    meta: [
      { title: "Risk Management — TradePilot AI" },
      { name: "description", content: "Configure demo risk limits, inspect Risk Governor decisions and pause all simulated trading with a kill switch." },
      { property: "og:title", content: "Risk Management — TradePilot AI" },
      { property: "og:description", content: "Risk Governor, configurable limits and a working kill switch." },
    ],
  }),
  component: RiskPage,
});

const SLIDERS: { key: keyof Omit<RiskLimits, "requireStopLoss">; label: string; hint: string; min: number; max: number; step: number }[] = [
  { key: "maxRiskPerTradePct", label: "Maximum risk per trade", hint: "Loss to stop-loss, % of portfolio", min: 0.5, max: 10, step: 0.5 },
  { key: "maxDailyLossPct", label: "Maximum daily loss", hint: "Realized loss today, % of portfolio", min: 1, max: 10, step: 0.5 },
  { key: "maxExposurePct", label: "Maximum portfolio exposure", hint: "Total invested, % of portfolio", min: 10, max: 100, step: 5 },
  { key: "maxPositionSizePct", label: "Maximum position size", hint: "One stock, % of portfolio", min: 5, max: 100, step: 5 },
];

function RiskPage() {
  const t = useTrading();
  const [dryRun, setDryRun] = useState<{ label: string; trade: ProposedTrade; evaluation: RiskEvaluation } | null>(null);
  const largest = Math.max(0, ...Object.values(t.positions.reduce<Record<string, number>>((m, p) => ({ ...m, [p.symbol]: (m[p.symbol] ?? 0) + p.qty * (t.prices[p.symbol] ?? p.entryPrice) }), {})));

  const usage = [
    { label: "Portfolio exposure", used: t.invested, limit: (t.limits.maxExposurePct / 100) * t.equity },
    { label: "Largest position", used: largest, limit: (t.limits.maxPositionSizePct / 100) * t.equity },
    { label: "Daily loss", used: t.dailyLoss, limit: (t.limits.maxDailyLossPct / 100) * t.equity },
  ];

  const test = (kind: "ok" | "big" | "nostop") => {
    const a = planAgentRun("A", t.equity).trade!;
    const b = planAgentRun("B", t.equity).trade!;
    const map = {
      ok: { label: "Compliant trade (Scenario A)", trade: a },
      big: { label: "Oversized trade (Scenario B)", trade: b },
      nostop: { label: "Trade without stop-loss", trade: { ...a, stopLoss: null } },
    } as const;
    const { label, trade } = map[kind];
    setDryRun({ label, trade, evaluation: t.previewTrade(trade) });
  };

  const shown = dryRun ?? (t.lastEvaluation ? { label: `Last submitted trade · ${dateTime(t.lastEvaluation.at)}`, trade: t.lastEvaluation.trade, evaluation: t.lastEvaluation.evaluation } : null);

  return (
    <div className="space-y-6">
      <PageHeader eyebrow="Risk Management" title="Risk Governor" description="Every simulated trade — from you or the AI agent — must pass these rules before it reaches the paper portfolio." />

      <section className={`panel flex flex-col gap-4 p-5 md:flex-row md:items-center md:justify-between ${t.killSwitch ? "ring-2 ring-destructive/60" : ""}`}>
        <div className="flex items-start gap-4">
          <div className={`grid size-12 shrink-0 place-items-center rounded-xl ${t.killSwitch ? "bg-destructive/15 text-destructive" : "bg-success/12 text-success"}`}>
            {t.killSwitch ? <OctagonPause className="size-6" /> : <ShieldCheck className="size-6" />}
          </div>
          <div>
            <h2 className="text-lg font-semibold">Kill switch</h2>
            <p className="text-sm text-muted-foreground">
              {t.killSwitch ? "Trading is PAUSED. All new simulated trades are blocked until you resume manually." : "Trading is enabled. Activate to immediately block every new simulated trade."}
            </p>
          </div>
        </div>
        {t.killSwitch ? (
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="success" size="lg"><PlayCircle /> Resume trading</Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Resume simulated trading?</AlertDialogTitle>
                <AlertDialogDescription>The agent and the order ticket will be able to submit simulated trades again. All risk limits still apply.</AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Keep paused</AlertDialogCancel>
                <AlertDialogAction
                  onClick={() => {
                    t.setKillSwitch(false);
                    toast.success("Trading resumed manually");
                  }}
                >
                  Yes, resume
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        ) : (
          <Button
            variant="destructive"
            size="lg"
            className="font-bold"
            onClick={() => {
              t.setKillSwitch(true);
              toast.error("Kill switch activated", { description: "All new simulated trades are paused." });
            }}
          >
            <OctagonPause /> Activate kill switch
          </Button>
        )}
      </section>

      <div className="grid gap-4 lg:grid-cols-2">
        <Panel title="Configurable demo limits" subtitle="Changes apply instantly to the Risk Governor" action={<Button variant="ghost" size="sm" onClick={() => t.setLimits(DEFAULT_LIMITS)}>Restore defaults</Button>}>
          <div className="space-y-5">
            {SLIDERS.map((s) => (
              <div key={s.key}>
                <div className="mb-2 flex items-baseline justify-between">
                  <div>
                    <div className="text-sm font-medium">{s.label}</div>
                    <div className="text-[11px] text-muted-foreground">{s.hint}</div>
                  </div>
                  <div className="text-right">
                    <div className="num text-lg font-semibold text-primary">{t.limits[s.key]}%</div>
                    <div className="num text-[11px] text-muted-foreground">{usd((t.limits[s.key] / 100) * t.equity, 0)}</div>
                  </div>
                </div>
                <Slider aria-label={s.label} min={s.min} max={s.max} step={s.step} value={[t.limits[s.key]]} onValueChange={([v]) => t.setLimits({ ...t.limits, [s.key]: v })} />
              </div>
            ))}
            <div className="flex items-center justify-between rounded-lg border bg-surface/50 p-3">
              <div>
                <div className="text-sm font-medium">Stop-loss requirement</div>
                <div className="text-[11px] text-muted-foreground">Every buy must include a stop below entry</div>
              </div>
              <Switch aria-label="Require stop-loss" checked={t.limits.requireStopLoss} onCheckedChange={(v) => t.setLimits({ ...t.limits, requireStopLoss: v })} />
            </div>
          </div>
        </Panel>

        <div className="space-y-4">
          <Panel title="Current utilization" subtitle="Live against your limits">
            <div className="space-y-4">
              {usage.map((u) => {
                const ratio = u.limit > 0 ? Math.min(u.used / u.limit, 1) : 0;
                const tone = ratio > 0.9 ? "bg-destructive" : ratio > 0.7 ? "bg-warning" : "bg-success";
                return (
                  <div key={u.label}>
                    <div className="mb-1.5 flex justify-between text-sm">
                      <span>{u.label}</span>
                      <span className="num text-muted-foreground">{usd(u.used, 0)} / {usd(u.limit, 0)}</span>
                    </div>
                    <div className="h-2 overflow-hidden rounded-full bg-muted">
                      <div className={`h-full rounded-full transition-all ${tone}`} style={{ width: `${ratio * 100}%` }} />
                    </div>
                  </div>
                );
              })}
            </div>
          </Panel>

          <Panel title="Risk Governor panel" subtitle="Run a dry-run test, or see the last submitted trade">
            <div className="mb-4 flex flex-wrap gap-2">
              <Button size="sm" variant="outline" onClick={() => test("ok")}>Test compliant trade</Button>
              <Button size="sm" variant="outline" onClick={() => test("big")}>Test oversized trade</Button>
              <Button size="sm" variant="outline" onClick={() => test("nostop")}>Test missing stop-loss</Button>
              {dryRun && <Button size="sm" variant="ghost" onClick={() => setDryRun(null)}>Show last submitted</Button>}
            </div>
            {shown ? (
              <div className="space-y-3">
                <div className="flex flex-wrap items-center gap-2 text-sm">
                  <Badge variant={dryRun ? "ai" : "info"}>{dryRun ? "Dry run — not executed" : "Submitted"}</Badge>
                  <span className="text-muted-foreground">{shown.label}</span>
                </div>
                <div className="num rounded-lg border bg-surface/50 px-3 py-2 text-sm">
                  {shown.trade.side} {shown.trade.qty} {shown.trade.symbol} @ {usd(shown.trade.entryPrice)} · stop {shown.trade.stopLoss ? usd(shown.trade.stopLoss) : "none"}
                </div>
                <DecisionBanner evaluation={shown.evaluation} />
                <RiskChecksList checks={shown.evaluation.checks} />
              </div>
            ) : (
              <p className="py-6 text-center text-sm text-muted-foreground">No trade evaluated yet. Run a test above or submit a paper trade.</p>
            )}
          </Panel>
        </div>
      </div>
    </div>
  );
}
