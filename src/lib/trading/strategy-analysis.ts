import { analyzeMarket, computeIndicators } from "./indicators";
import { getStock, priceOf } from "./market-data";
import { portfolioEquity, type PortfolioSnapshot } from "./risk";
import { runStrategy } from "./strategies";
import type { ProposedTrade, RiskLimits, StrategyId } from "./types";

/** A proposed long plan, not an order: submission always rechecks current portfolio risk. */
export function buildStrategyAnalysis(id: Exclude<StrategyId, "manual">, symbol: string, snapshot: PortfolioSnapshot, limits: RiskLimits) {
  const indicators = computeIndicators(getStock(symbol).history);
  const market = analyzeMarket(indicators);
  const signal = runStrategy(id, symbol);
  const condition = market.trend === "Sideways" ? "Ranging" : "Trending";
  const spread = (indicators.sma20 - indicators.sma50) / indicators.sma50 * 100;
  const reason = condition === "Ranging"
    ? `The averages are ${Math.abs(spread).toFixed(1)}% apart without aligned directional price confirmation.`
    : `The 20-day average is ${Math.abs(spread).toFixed(1)}% ${spread > 0 ? "above" : "below"} the 50-day, with price confirming the ${market.trend.toLowerCase()}.`;
  const fit = id === "trend"
    ? `${condition === "Trending" ? "Trend following fits this directional market" : "Trend following is less suited to this ranging market"} because it needs aligned moving averages and price confirmation. ${signal.signal === "BUY" ? "The bullish structure supports a long entry with an ATR-based stop and a target twice the stop distance." : "There is no confirmed long entry; the agent waits rather than opening a position against its rules."}`
    : `${condition === "Ranging" ? "Mean reversion fits this ranging market" : "Mean reversion is less suited to this trending market"} because it looks for stretched prices returning toward their average. ${signal.signal === "BUY" ? "The downside stretch supports a potential rebound, with an ATR-based stop limiting the proposed loss." : "The downside stretch is not confirmed, so the agent waits for an oversold long setup."}`;
  const equity = portfolioEquity(snapshot);
  const entry = priceOf(symbol);
  const existing = snapshot.positions.filter((p) => p.symbol === symbol).reduce((sum, p) => sum + p.qty * entry, 0);
  const perShareRisk = entry - signal.stopLoss;
  // Target 5% new capital and 1% risk, leaving headroom below mandatory strict caps.
  const sizeBudget = Math.max(0, Math.min(equity * 0.05, equity * Math.min(0.095, limits.maxPositionSizePct / 100 * 0.95) - existing));
  const exposureUsed = snapshot.positions.reduce((sum, p) => sum + p.qty * (snapshot.prices[p.symbol] ?? p.entryPrice), 0);
  const exposureBudget = Math.max(0, equity * limits.maxExposurePct / 100 - exposureUsed);
  const qty = Math.max(0, Math.floor(Math.min(sizeBudget / entry, snapshot.cash / entry, exposureBudget / entry,
    equity * Math.min(0.01, limits.maxRiskPerTradePct / 100 * 0.95) / perShareRisk)));
  const trade: ProposedTrade = { symbol, side: "BUY", qty, entryPrice: entry, stopLoss: signal.stopLoss, takeProfit: signal.takeProfit, strategy: id };
  return { id, symbol, signal, condition, reason, fit, trade };
}