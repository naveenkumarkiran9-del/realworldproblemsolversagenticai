import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { RiskChecksList } from "./risk-checks";
import { SimTag } from "./page-header";
import { dateTime, signedUsd, usd } from "@/lib/format";
import { STRATEGY_NAMES, type JournalEntry } from "@/lib/trading/types";

export function StatusBadge({ entry }: { entry: JournalEntry }) {
  if (entry.status === "Rejected") return <Badge variant="danger">Rejected</Badge>;
  if (entry.status === "Open") return <Badge variant="info">Open</Badge>;
  return <Badge variant={(entry.pnl ?? 0) >= 0 ? "success" : "danger"}>Closed</Badge>;
}

export function TradeDetailDialog({ entry, onOpenChange }: { entry: JournalEntry | null; onOpenChange: (o: boolean) => void }) {
  return (
    <Dialog open={!!entry} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-xl">
        {entry && (
          <>
            <DialogHeader>
              <div className="flex items-center gap-2">
                <SimTag>Paper trade</SimTag>
                <StatusBadge entry={entry} />
              </div>
              <DialogTitle className="font-display text-xl">
                {entry.id} · {entry.side} {entry.qty} {entry.symbol}
              </DialogTitle>
              <DialogDescription>
                {dateTime(entry.timestamp)} · {STRATEGY_NAMES[entry.strategy]} · Source: {entry.source}
              </DialogDescription>
            </DialogHeader>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              {[
                ["Entry", usd(entry.entryPrice)],
                ["Exit", entry.exitPrice ? usd(entry.exitPrice) : "—"],
                ["Quantity", String(entry.qty)],
                ["Stop-loss", entry.stopLoss ? usd(entry.stopLoss) : "None"],
                ["Take-profit", entry.takeProfit ? usd(entry.takeProfit) : "None"],
                ["Simulated P&L", entry.pnl !== null ? signedUsd(entry.pnl) : "—"],
              ].map(([k, v]) => (
                <div key={k} className="rounded-lg border bg-surface/60 p-2.5">
                  <div className="text-[11px] text-muted-foreground">{k}</div>
                  <div className={`num text-sm font-semibold ${k === "Simulated P&L" && entry.pnl !== null ? (entry.pnl >= 0 ? "text-success" : "text-destructive") : ""}`}>{v}</div>
                </div>
              ))}
            </div>
            <div className="rounded-xl border border-ai/30 bg-ai/8 p-3">
              <div className="mb-1 text-xs font-semibold uppercase tracking-wider text-ai">AI decision explanation</div>
              <p className="text-sm">{entry.aiExplanation}</p>
            </div>
            <div>
              <div className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Risk check result</div>
              <p className={`mb-2 text-sm font-medium ${entry.decision === "Accepted" ? "text-success" : "text-destructive"}`}>{entry.riskResult}</p>
              {entry.checks.length > 0 && <RiskChecksList checks={entry.checks} />}
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
