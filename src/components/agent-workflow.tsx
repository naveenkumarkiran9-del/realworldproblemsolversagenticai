import { Check, Loader2, Minus, X } from "lucide-react";

export const WORKFLOW_STAGES = [
  { title: "Receive data", desc: "Load sample market data" },
  { title: "Validate", desc: "Check data integrity" },
  { title: "Analyze", desc: "Read market conditions" },
  { title: "Select strategy", desc: "Pick best-fit playbook" },
  { title: "Generate signal", desc: "Simulated trade signal" },
  { title: "Evaluate trade", desc: "Size entry, stop, target" },
  { title: "Risk Governor", desc: "Run all risk checks" },
  { title: "Decide", desc: "Approve or reject" },
  { title: "Paper execute", desc: "Simulator only" },
  { title: "Journal", desc: "Record the decision" },
] as const;

export type StageState = "pending" | "active" | "done" | "failed" | "skipped";

export function AgentWorkflow({ states }: { states: StageState[] }) {
  return (
    <ol className="grid grid-cols-2 gap-2 sm:grid-cols-5">
      {WORKFLOW_STAGES.map((s, i) => {
        const st = states[i] ?? "pending";
        const ring =
          st === "done"
            ? "border-success/40 bg-success/8"
            : st === "failed"
              ? "border-destructive/50 bg-destructive/12"
              : st === "active"
                ? "border-ai/60 bg-ai/12 shadow-glow"
                : st === "skipped"
                  ? "border-border bg-muted/40 opacity-60"
                  : "border-border bg-surface/50";
        const dot =
          st === "done"
            ? "bg-success text-success-foreground"
            : st === "failed"
              ? "bg-destructive text-destructive-foreground"
              : st === "active"
                ? "bg-ai text-ai-foreground animate-pulse-ring"
                : "bg-muted text-muted-foreground";
        return (
          <li key={s.title} className={`relative rounded-xl border p-3 transition-all duration-300 ${ring}`}>
            <div className="flex items-center gap-2">
              <span className={`grid size-6 shrink-0 place-items-center rounded-full text-[11px] font-bold ${dot}`}>
                {st === "done" ? <Check className="size-3.5" /> : st === "failed" ? <X className="size-3.5" /> : st === "active" ? <Loader2 className="size-3.5 animate-spin" /> : st === "skipped" ? <Minus className="size-3.5" /> : i + 1}
              </span>
              <span className="text-sm font-semibold leading-tight">{s.title}</span>
            </div>
            <p className="mt-1.5 text-[11px] leading-snug text-muted-foreground">{s.desc}</p>
          </li>
        );
      })}
    </ol>
  );
}
