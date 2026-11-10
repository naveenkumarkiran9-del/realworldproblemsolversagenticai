import { useRef, useState } from "react";
import { Link } from "@tanstack/react-router";
import { BrainCircuit, Play, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { AgentWorkflow, type StageState } from "./agent-workflow";
import { DecisionBanner, RiskChecksList } from "./risk-checks";
import { SimTag } from "./page-header";
import { planAgentRun, type AgentMode, type AgentPlan } from "@/lib/trading/scenarios";
import { useTrading } from "@/lib/trading/store";
import { STRATEGY_NAMES, type RiskEvaluation } from "@/lib/trading/types";
import { usd } from "@/lib/format";

const MODES: { id: AgentMode; label: string; hint: string }[] = [
  { id: "scan", label: "Agent scan", hint: "Agent scans all demo stocks" },
  { id: "A", label: "Scenario A", hint: "Opportunity passes risk checks" },
  { id: "B", label: "Scenario B", hint: "Opportunity violates a risk rule" },
];

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export function AgentRunPanel() {
  const { equity, submitTrade } = useTrading();
  const [mode, setMode] = useState<AgentMode>("A");
  const [states, setStates] = useState<StageState[]>(Array(10).fill("pending"));
  const [step, setStep] = useState(-1);
  const [plan, setPlan] = useState<AgentPlan | null>(null);
  const [evaluation, setEvaluation] = useState<RiskEvaluation | null>(null);
  const [entryId, setEntryId] = useState<string | null>(null);
  const [running, setRunning] = useState(false);
  const runId = useRef(0);

  const run = async () => {
    const id = ++runId.current;
    setRunning(true);
    setEvaluation(null);
    setEntryId(null);
    const p = planAgentRun(mode, equity);
    setPlan(p);
    const st: StageState[] = Array(10).fill("pending");
    const push = (i: number, s: StageState) => {
      st[i] = s;
      setStates([...st]);
    };
    for (let i = 0; i < 10; i++) {
      if (runId.current !== id) return;
      push(i, "active");
      setStep(i);
      await sleep(i === 6 ? 900 : 480);
      if (runId.current !== id) return;

      if (!p.trade && i >= 5) {
        for (let j = i; j < 10; j++) push(j, "skipped");
        setStep(10);
        toast.info("Agent decision: HOLD — no trade proposed");
        break;
      }
      if (i === 6 && p.trade) {
        const res = submitTrade(p.trade, {
          source: mode === "A" ? "Scenario A" : mode === "B" ? "Scenario B" : "AI Agent",
          aiExplanation: p.rationale,
        });
        setEvaluation(res.evaluation);
        setEntryId(res.entryId);
        push(i, res.evaluation.approved ? "done" : "failed");
        if (!res.evaluation.approved) {
          await sleep(350);
          push(7, "failed");
          setStep(7);
          await sleep(350);
          push(8, "skipped");
          await sleep(300);
          push(9, "done");
          setStep(10);
          toast.error("Trade rejected by Risk Governor", { description: res.evaluation.explanation });
          break;
        }
        continue;
      }
      push(i, "done");
      if (i === 9) {
        setStep(10);
        toast.success("Paper trade executed", { description: `${p.trade?.qty} ${p.symbol} @ ${usd(p.trade?.entryPrice ?? 0)} — simulated` });
      }
    }
    setRunning(false);
  };

  const shown = (minStep: number) => plan && step >= minStep;

  return (
    <section className="panel-hero relative overflow-hidden p-5 md:p-6">
      <div className="pointer-events-none absolute inset-0 grid-bg opacity-40 [mask-image:linear-gradient(to_bottom,black,transparent_70%)]" />
      <div className="relative">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <div className="flex items-center gap-2">
              <Badge variant="ai">
                <BrainCircuit className="mr-1 size-3.5" /> AI Agent
              </Badge>
              <SimTag />
            </div>
            <h2 className="mt-2 text-xl font-semibold md:text-2xl">
              Agent workflow <span className="text-gradient-ai">end-to-end</span>
            </h2>
            <p className="mt-1 max-w-xl text-sm text-muted-foreground">Pick a run mode and watch the agent move from raw demo data to a paper-trading decision. Every trade passes the Risk Governor.</p>
          </div>
          <div className="flex flex-col gap-2 sm:items-end">
            <div role="radiogroup" aria-label="Run mode" className="inline-flex rounded-xl border bg-background/50 p-1">
              {MODES.map((m) => (
                <button
                  key={m.id}
                  role="radio"
                  aria-checked={mode === m.id}
                  disabled={running}
                  onClick={() => setMode(m.id)}
                  className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors disabled:opacity-50 ${mode === m.id ? "bg-secondary text-foreground shadow" : "text-muted-foreground hover:text-foreground"}`}
                >
                  {m.label}
                </button>
              ))}
            </div>
            <span className="text-xs text-muted-foreground">{MODES.find((m) => m.id === mode)?.hint}</span>
            <Button variant="ai" size="lg" onClick={run} disabled={running}>
              {running ? <Sparkles className="animate-spin" /> : <Play />}
              {running ? "Analyzing…" : "Run AI Analysis"}
            </Button>
          </div>
        </div>

        <div className="mt-5">
          <AgentWorkflow states={states} />
        </div>

        {plan && (
          <div className="mt-5 grid gap-3 lg:grid-cols-4">
            <ResultCard title="Market conditions" visible={!!shown(3)}>
              <Row k="Symbol" v={plan.symbol} />
              <Row k="Trend" v={plan.analysis.trend} />
              <Row k="Condition" v={plan.analysis.condition} />
              <Row k="Risk level" v={plan.analysis.riskLevel} />
            </ResultCard>
            <ResultCard title="Selected strategy" visible={!!shown(5)}>
              <div className="text-sm font-semibold">{STRATEGY_NAMES[plan.trade?.strategy ?? plan.analysis.strategy]}</div>
              <Row k="Signal" v={plan.trade ? plan.signal.signal : "HOLD"} />
              <Row k="Confidence" v={`${plan.signal.confidence}/100`} />
              <p className="mt-1 text-[11px] text-muted-foreground">Simulated model output — not a guarantee of accuracy.</p>
            </ResultCard>
            <ResultCard title="Proposed trade" visible={!!shown(6)}>
              {plan.trade ? (
                <>
                  <Row k="Order" v={`BUY ${plan.trade.qty} ${plan.trade.symbol}`} />
                  <Row k="Entry" v={usd(plan.trade.entryPrice)} />
                  <Row k="Stop-loss" v={plan.trade.stopLoss ? usd(plan.trade.stopLoss) : "None"} />
                  <Row k="Take-profit" v={plan.trade.takeProfit ? usd(plan.trade.takeProfit) : "None"} />
                  <Row k="Notional" v={usd(plan.trade.qty * plan.trade.entryPrice, 0)} />
                </>
              ) : (
                <p className="text-sm text-muted-foreground">No trade — HOLD.</p>
              )}
            </ResultCard>
            <ResultCard title="Risk assessment" visible={!!evaluation}>
              {evaluation && <RiskChecksList checks={evaluation.checks} compact />}
            </ResultCard>
          </div>
        )}

        {plan && step >= 10 && (
          <div className="mt-4 space-y-3 animate-in fade-in slide-in-from-bottom-2">
            {evaluation ? <DecisionBanner evaluation={evaluation} /> : <div className="rounded-xl border bg-surface/60 p-4 text-sm">Final decision: <b>HOLD</b>. {plan.rationale}</div>}
            <p className="text-sm text-muted-foreground">{plan.rationale}</p>
            {entryId && (
              <Link to="/journal" className="inline-flex text-sm font-semibold text-primary hover:underline">
                Recorded in Trade Journal as {entryId} →
              </Link>
            )}
          </div>
        )}
      </div>
    </section>
  );
}

function ResultCard({ title, visible, children }: { title: string; visible: boolean; children: React.ReactNode }) {
  return (
    <div className={`rounded-xl border bg-background/50 p-3.5 transition-all duration-500 ${visible ? "opacity-100" : "opacity-30 blur-[1px]"}`}>
      <div className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{title}</div>
      {visible ? <div className="space-y-1">{children}</div> : <div className="h-16 animate-pulse rounded-lg bg-muted/50" />}
    </div>
  );
}

function Row({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex items-baseline justify-between gap-2 text-sm">
      <span className="text-muted-foreground">{k}</span>
      <span className="num text-right font-medium">{v}</span>
    </div>
  );
}
