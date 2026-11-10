import type { Position, ProposedTrade, RiskCheck, RiskEvaluation, RiskLimits } from "./types";

export const DEFAULT_LIMITS: RiskLimits = {
  maxRiskPerTradePct: 2,
  maxDailyLossPct: 3,
  maxExposurePct: 80,
  maxPositionSizePct: 25,
  requireStopLoss: true,
};

export interface PortfolioSnapshot {
  cash: number;
  positions: Position[];
  prices: Record<string, number>;
  /** Realized loss today as a positive number. */
  dailyLoss: number;
  killSwitch: boolean;
}

const usd = (v: number) =>
  v.toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });

export function portfolioEquity(s: Pick<PortfolioSnapshot, "cash" | "positions" | "prices">) {
  return s.cash + s.positions.reduce((a, p) => a + p.qty * (s.prices[p.symbol] ?? p.entryPrice), 0);
}

export function exposure(s: Pick<PortfolioSnapshot, "positions" | "prices">) {
  return s.positions.reduce((a, p) => a + p.qty * (s.prices[p.symbol] ?? p.entryPrice), 0);
}

/**
 * The Risk Governor. Every simulated order passes through here before it can
 * touch the paper portfolio. Pure function: same inputs, same decision.
 */
export function evaluateTrade(trade: ProposedTrade, snap: PortfolioSnapshot, limits: RiskLimits): RiskEvaluation {
  const checks: RiskCheck[] = [];
  const equity = portfolioEquity(snap);
  const add = (id: string, label: string, passed: boolean, detail: string) => checks.push({ id, label, passed, detail });

  const validInput =
    Number.isFinite(trade.qty) && Number.isInteger(trade.qty) && trade.qty > 0 && Number.isFinite(trade.entryPrice) && trade.entryPrice > 0;
  add("input", "Order input is valid", validInput, validInput ? `${trade.qty} × ${trade.symbol} @ $${trade.entryPrice.toFixed(2)}` : "Quantity must be a whole number above 0 and price must be positive.");

  add("kill", "Kill switch is off", !snap.killSwitch, snap.killSwitch ? "Trading is paused by the kill switch. Resume manually to trade." : "Trading is enabled.");

  if (!validInput) return finish(checks, "Trade rejected: the order input is invalid.");

  const notional = trade.qty * trade.entryPrice;

  if (trade.side === "SELL") {
    const held = snap.positions.filter((p) => p.symbol === trade.symbol).reduce((a, p) => a + p.qty, 0);
    add("holding", "Sufficient shares held", held >= trade.qty, `Holding ${held} share(s); selling ${trade.qty}.`);
    return finish(checks, held < trade.qty ? `Trade rejected: you only hold ${held} share(s) of ${trade.symbol} (long-only demo, no short selling).` : undefined);
  }

  // 1. Stop-loss validity
  const hasStop = trade.stopLoss !== null && Number.isFinite(trade.stopLoss) && trade.stopLoss > 0;
  const stopBelow = hasStop && (trade.stopLoss as number) < trade.entryPrice;
  const stopOk = limits.requireStopLoss ? hasStop && stopBelow : !hasStop || stopBelow;
  add(
    "stop",
    "Valid stop-loss",
    stopOk,
    !hasStop
      ? limits.requireStopLoss
        ? "No stop-loss provided, but the rules require one."
        : "No stop-loss (allowed by current settings)."
      : stopBelow
        ? `Stop at $${(trade.stopLoss as number).toFixed(2)} is below entry.`
        : `Stop at $${(trade.stopLoss as number).toFixed(2)} must be below the entry price.`,
  );

  // 2. Risk per trade
  const riskAmount = hasStop && stopBelow ? (trade.entryPrice - (trade.stopLoss as number)) * trade.qty : notional;
  const riskLimit = (limits.maxRiskPerTradePct / 100) * equity;
  add("risk", `Risk per trade ≤ ${limits.maxRiskPerTradePct}%`, riskAmount <= riskLimit, `At risk ${usd(riskAmount)} vs limit ${usd(riskLimit)}.`);

  // 3. Daily loss
  const dailyLimit = (limits.maxDailyLossPct / 100) * equity;
  add("daily", `Daily loss < ${limits.maxDailyLossPct}%`, snap.dailyLoss < dailyLimit, `Lost today ${usd(snap.dailyLoss)} vs limit ${usd(dailyLimit)}.`);

  // 4. Position size
  const existing = snap.positions.filter((p) => p.symbol === trade.symbol).reduce((a, p) => a + p.qty * (snap.prices[p.symbol] ?? p.entryPrice), 0);
  const posLimit = (limits.maxPositionSizePct / 100) * equity;
  add("size", `Position size ≤ ${limits.maxPositionSizePct}%`, existing + notional <= posLimit, `${trade.symbol} position would be ${usd(existing + notional)} vs limit ${usd(posLimit)}.`);

  // 5. Exposure
  const exp = exposure(snap) + notional;
  const expLimit = (limits.maxExposurePct / 100) * equity;
  add("exposure", `Portfolio exposure ≤ ${limits.maxExposurePct}%`, exp <= expLimit, `Total invested would be ${usd(exp)} vs limit ${usd(expLimit)}.`);

  // 6. Cash
  add("cash", "Enough virtual cash", notional <= snap.cash, `Order cost ${usd(notional)} vs cash ${usd(snap.cash)}.`);

  const reasons: Record<string, string> = {
    kill: "Trade rejected: trading is paused by the kill switch.",
    stop: "Trade rejected: the trade does not have a valid stop-loss.",
    risk: "Trade rejected: proposed position exceeds the configured risk limit.",
    daily: "Trade rejected: the daily loss limit has been reached.",
    size: "Trade rejected: position size exceeds the maximum allowed for one stock.",
    exposure: "Trade rejected: total portfolio exposure would exceed the configured limit.",
    cash: "Trade rejected: not enough virtual cash.",
  };
  const firstFail = checks.find((c) => !c.passed);
  return finish(checks, firstFail ? reasons[firstFail.id] : undefined);
}

function finish(checks: RiskCheck[], rejection?: string): RiskEvaluation {
  const failed = checks.filter((c) => !c.passed);
  if (failed.length === 0 && !rejection) {
    return { approved: true, checks, explanation: "Trade approved: all risk checks passed. Executing in the paper-trading simulator only." };
  }
  const extra = failed.length > 1 ? ` (${failed.length} checks failed)` : "";
  return { approved: false, checks, explanation: (rejection ?? `Trade rejected: ${failed[0]?.label.toLowerCase() ?? "a risk check"} failed.`) + extra };
}
