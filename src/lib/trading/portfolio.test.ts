import { describe, expect, it } from "vitest";
import { derivePortfolio } from "./portfolio";
import { at, getStock, priceOf } from "./market-data";
import { runStrategy } from "./strategies";
import type { JournalEntry } from "./types";

const row = (over: Partial<JournalEntry> = {}): JournalEntry => ({ id: "T-1", timestamp: "2026-11-01T12:00:00Z", symbol: "AAPL", side: "BUY", strategy: "manual", entryPrice: 100, exitPrice: null, qty: 10, stopLoss: 95, takeProfit: 110, pnl: null, status: "Open", decision: "Accepted", aiExplanation: "", riskResult: "", checks: [], closedAt: null, source: "Manual", ...over });

describe("shared quotes and ledger", () => {
  it.each(["AAPL", "MSFT", "NVDA", "TSLA", "AMZN", "GOOGL"])("uses the same %s quote for charts and strategy orders", (symbol) => {
    expect(runStrategy("trend", symbol).entry).toBe(priceOf(symbol));
    expect(at(getStock(symbol).history, -1).close).toBe(priceOf(symbol));
  });
  it("sorts dates newest first regardless of input order", () => {
    expect(derivePortfolio([row(), row({ id: "T-2", timestamp: "2026-11-03T12:00:00Z" })]).journal.map((j) => j.id)).toEqual(["T-2", "T-1"]);
  });
  it("derives every balance from entries and ignores stale P&L", () => {
    const p = derivePortfolio([row(), row({ id: "T-2", status: "Closed", exitPrice: 110, pnl: 9999, closedAt: "2026-11-02T12:00:00Z" })]);
    expect(p.cash).toBe(99_100);
    expect(p.realizedPnl).toBe(100);
    expect(p.invested).toBe(priceOf("AAPL") * 10);
    expect(p.totalPnl).toBe(Math.round((100 + (priceOf("AAPL") - 100) * 10) * 100) / 100);
    expect(p.equity).toBe(p.cash + p.invested);
    expect(p.winRate).toBe(100);
    expect(p.tradeCount).toBe(2);
  });
  it("rejections never change cash, equity or executed count", () => {
    const p = derivePortfolio([row({ decision: "Rejected", status: "Rejected", pnl: -5000 })]);
    expect(p.cash).toBe(100_000);
    expect(p.equity).toBe(100_000);
    expect(p.totalPnl).toBe(0);
    expect(p.tradeCount).toBe(0);
    expect(p.decisionCount).toBe(1);
  });
  it("partial exits do not inflate executed trade counts", () => {
    const p = derivePortfolio([row({ qty: 5 }), row({ id: "T-1-P1-10", qty: 5, status: "Closed", exitPrice: 110 })]);
    expect(p.tradeCount).toBe(1);
    expect(p.positions[0]?.qty).toBe(5);
    expect(p.realizedPnl).toBe(50);
    expect(p.cash).toBe(99_550);
  });
});