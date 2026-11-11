import { priceOf } from "./market-data";
import type { JournalEntry, Position } from "./types";

export const STARTING_CAPITAL = 100_000;
const cents = (n: number) => Math.round(n * 100) / 100;

/** The journal is the ledger; cached balances and positions are never authoritative. */
export function derivePortfolio(entries: JournalEntry[]) {
  const journal = entries.map((j) => ({
    ...j,
    pnl: j.decision === "Accepted" && j.status === "Closed" && j.exitPrice !== null
      ? cents((j.exitPrice - j.entryPrice) * j.qty) : null,
  })).sort((a, b) => Date.parse(b.timestamp) - Date.parse(a.timestamp) || b.id.localeCompare(a.id));
  const accepted = journal.filter((j) => j.decision === "Accepted");
  const closed = accepted.filter((j) => j.status === "Closed" && j.pnl !== null);
  const positions: Position[] = accepted.filter((j) => j.status === "Open" && j.side === "BUY")
    .map((j) => ({ id: j.id, symbol: j.symbol, qty: j.qty, entryPrice: j.entryPrice,
      stopLoss: j.stopLoss, takeProfit: j.takeProfit, strategy: j.strategy, openedAt: j.timestamp }));
  const realizedPnl = cents(closed.reduce((sum, j) => sum + (j.pnl ?? 0), 0));
  const costBasis = positions.reduce((sum, p) => sum + p.qty * p.entryPrice, 0);
  const cash = cents(STARTING_CAPITAL + realizedPnl - costBasis);
  const invested = cents(positions.reduce((sum, p) => sum + p.qty * priceOf(p.symbol), 0));
  const unrealizedPnl = cents(invested - costBasis);
  const tradeCount = new Set(accepted.map((j) => j.id.split("-P")[0])).size;
  const decisionCount = new Set(journal.map((j) => j.id.split("-P")[0])).size;
  return { journal, positions, cash, invested, equity: cents(cash + invested), realizedPnl,
    unrealizedPnl, totalPnl: cents(realizedPnl + unrealizedPnl), tradeCount, decisionCount,
    winRate: closed.length ? closed.filter((j) => (j.pnl ?? 0) > 0).length / closed.length * 100 : 0 };
}