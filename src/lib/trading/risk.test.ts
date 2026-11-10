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
  qty: 100,
  entryPrice: 100,
  stopLoss: 95,
  takeProfit: 110,
  strategy: "manual",
  ...over,
});

describe("Risk Governor", () => {
  it("approves a trade within every limit", () => {
    // $10k position (10%), $500 at risk (0.5%)
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

  it("rejects a single position above 25% of equity", () => {
    // 300 × $100 = $30k > $25k, risk 300 × $5 = $1.5k OK
    const r = evaluateTrade(buy({ qty: 300 }), snap(), DEFAULT_LIMITS);
    expect(r.approved).toBe(false);
    expect(r.checks.find((c) => c.id === "size")?.passed).toBe(false);
  });

  it("rejects every trade while the kill switch is on", () => {
    const r = evaluateTrade(buy(), snap({ killSwitch: true }), DEFAULT_LIMITS);
    expect(r.approved).toBe(false);
    expect(r.explanation).toContain("kill switch");
  });

  it("rejects when virtual cash is insufficient", () => {
    const r = evaluateTrade(buy(), snap({ cash: 5_000 }), { ...DEFAULT_LIMITS, maxPositionSizePct: 100, maxExposurePct: 100 });
    expect(r.checks.find((c) => c.id === "cash")?.passed).toBe(false);
    expect(r.approved).toBe(false);
  });

  it("rejects selling more shares than held (no shorting)", () => {
    const r = evaluateTrade(buy({ side: "SELL", qty: 5 }), snap(), DEFAULT_LIMITS);
    expect(r.approved).toBe(false);
  });
});
