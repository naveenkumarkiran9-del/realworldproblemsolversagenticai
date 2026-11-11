import { describe, expect, it } from "vitest";
import { DEFAULT_LIMITS, evaluateTrade, type PortfolioSnapshot } from "./risk";
import type { ProposedTrade } from "./types";

const snap = (over: Partial<PortfolioSnapshot> = {}): PortfolioSnapshot => ({
  cash: 100_000,
  positions: [],
  prices: { AAPL: 100 },
  dailyLoss: 0,
  killSwitch: false,
  ...over,
});

const buy = (over: Partial<ProposedTrade> = {}): ProposedTrade => ({
  symbol: "AAPL",
  side: "BUY",
  qty: 50,
  entryPrice: 100,
  stopLoss: 95,
  takeProfit: 110,
  strategy: "manual",
  ...over,
});

describe("Risk Governor", () => {
  it("approves a trade within every limit", () => {
    // $5k position (5%), $250 at risk (0.25%)
    expect(evaluateTrade(buy(), snap(), DEFAULT_LIMITS).approved).toBe(true);
  });

  it("rejects when risk to stop exceeds the 2% per-trade limit", () => {
    // $100 × 50 share risk = $5,000 > $2,000
    const r = evaluateTrade(buy({ qty: 200, stopLoss: 75 }), snap(), DEFAULT_LIMITS);
    expect(r.approved).toBe(false);
    expect(r.explanation).toContain("proposed position exceeds the configured risk limit");
  });

  it("rejects a buy without stop-loss when stop-loss is required", () => {
    const r = evaluateTrade(buy({ stopLoss: null }), snap(), DEFAULT_LIMITS);
    expect(r.approved).toBe(false);
    expect(r.checks.find((c) => c.id === "stop")?.passed).toBe(false);
  });

  it("rejects a stop-loss placed above the entry price", () => {
    expect(evaluateTrade(buy({ stopLoss: 101 }), snap(), DEFAULT_LIMITS).approved).toBe(false);
  });

  it("rejects once the 3% daily loss limit is reached", () => {
    const r = evaluateTrade(buy(), snap({ dailyLoss: 3_000 }), DEFAULT_LIMITS);
    expect(r.approved).toBe(false);
    expect(r.explanation).toContain("daily loss limit");
  });

  it("rejects a single position at the strict 10% equity boundary", () => {
    const r = evaluateTrade(buy({ qty: 100 }), snap(), DEFAULT_LIMITS);
    expect(r.approved).toBe(false);
    expect(r.checks.find((c) => c.id === "size")?.passed).toBe(false);
  });

  it("counts existing shares toward the 10% position limit", () => {
    const r = evaluateTrade(buy({ qty: 50 }), snap({ positions: [{ id: "old", symbol: "AAPL", qty: 60, entryPrice: 100, stopLoss: 95, takeProfit: 110, strategy: "manual", openedAt: "2026-11-01" }], cash: 94_000 }), DEFAULT_LIMITS);
    expect(r.checks.find((c) => c.id === "size")?.passed).toBe(false);
  });

  it("rejects risk exactly at 2% of equity", () => {
    const r = evaluateTrade(buy({ qty: 50, stopLoss: 60, takeProfit: 160 }), snap(), DEFAULT_LIMITS);
    expect(r.checks.find((c) => c.id === "risk")?.passed).toBe(false);
  });

  it("requires a stop even when persisted settings disable it", () => {
    const r = evaluateTrade(buy({ stopLoss: null }), snap(), { ...DEFAULT_LIMITS, requireStopLoss: false });
    expect(r.checks.find((c) => c.id === "stop")?.passed).toBe(false);
  });

  it("rejects reward-to-risk below 1.5", () => {
    const r = evaluateTrade(buy({ takeProfit: 107 }), snap(), DEFAULT_LIMITS);
    expect(r.checks.find((c) => c.id === "reward")?.passed).toBe(false);
  });

  it("accepts reward-to-risk exactly 1.5", () => {
    expect(evaluateTrade(buy({ takeProfit: 107.5 }), snap(), DEFAULT_LIMITS).approved).toBe(true);
  });

  it("rejects a missing target with a reward-to-risk reason", () => {
    expect(evaluateTrade(buy({ takeProfit: null }), snap(), DEFAULT_LIMITS).checks.find((c) => c.id === "reward")?.passed).toBe(false);
  });

  it("cannot relax the 10% or 2% caps through settings", () => {
    const r = evaluateTrade(buy({ qty: 200, stopLoss: 90 }), snap(), { ...DEFAULT_LIMITS, maxPositionSizePct: 100, maxRiskPerTradePct: 100 });
    expect(r.checks.find((c) => c.id === "size")?.passed).toBe(false);
    expect(r.checks.find((c) => c.id === "risk")?.passed).toBe(false);
  });

  it("rejects every trade while the kill switch is on", () => {
    const r = evaluateTrade(buy(), snap({ killSwitch: true }), DEFAULT_LIMITS);
    expect(r.approved).toBe(false);
    expect(r.explanation).toContain("kill switch");
  });

  it("rejects when virtual cash is insufficient", () => {
    const r = evaluateTrade(buy(), snap({ cash: 4_000 }), { ...DEFAULT_LIMITS, maxPositionSizePct: 100, maxExposurePct: 100 });
    expect(r.checks.find((c) => c.id === "cash")?.passed).toBe(false);
    expect(r.approved).toBe(false);
  });

  it("rejects selling more shares than held (no shorting)", () => {
    const r = evaluateTrade(buy({ side: "SELL", qty: 5 }), snap(), DEFAULT_LIMITS);
    expect(r.approved).toBe(false);
  });
});
