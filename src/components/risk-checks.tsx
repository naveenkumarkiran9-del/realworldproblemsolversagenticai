import { CheckCircle2, XCircle } from "lucide-react";
import type { RiskCheck, RiskEvaluation } from "@/lib/trading/types";

export function RiskChecksList({ checks, compact = false }: { checks: RiskCheck[]; compact?: boolean }) {
  return (
    <ul className={compact ? "space-y-1.5" : "space-y-2"}>
      {checks.map((c) => (
        <li key={c.id} className={`flex items-start gap-2.5 rounded-lg border px-3 ${compact ? "py-1.5" : "py-2"} ${c.passed ? "border-success/20 bg-success/5" : "border-destructive/30 bg-destructive/10"}`}>
          {c.passed ? <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-success" /> : <XCircle className="mt-0.5 size-4 shrink-0 text-destructive" />}
          <div className="min-w-0">
            <div className={`text-sm font-medium ${c.passed ? "text-foreground" : "text-destructive"}`}>{c.label}</div>
            {!compact && <div className="text-xs text-muted-foreground">{c.detail}</div>}
          </div>
        </li>
      ))}
    </ul>
  );
}

export function DecisionBanner({ evaluation }: { evaluation: RiskEvaluation }) {
  return (
    <div className={`flex items-start gap-3 rounded-xl border p-4 ${evaluation.approved ? "border-success/35 bg-success/10" : "border-destructive/40 bg-destructive/10"}`}>
      {evaluation.approved ? <CheckCircle2 className="mt-0.5 size-5 shrink-0 text-success" /> : <XCircle className="mt-0.5 size-5 shrink-0 text-destructive" />}
      <div>
        <div className={`font-display font-semibold ${evaluation.approved ? "text-success" : "text-destructive"}`}>{evaluation.approved ? "APPROVED — Paper trade executed" : "REJECTED — Trade blocked"}</div>
        <p className="mt-0.5 text-sm text-foreground/90">{evaluation.explanation}</p>
      </div>
    </div>
  );
}
