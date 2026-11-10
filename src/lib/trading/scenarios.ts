import { analyzeMarket, computeIndicators, type MarketAnalysis } from "./indicators";
import { at, getStock, STOCKS } from "./market-data";
import { runStrategy, type StrategySignal } from "./strategies";
import type { ProposedTrade } from "./types";

export type AgentMode = "scan" | "A" | "B";

export interface AgentPlan {
  mode: AgentMode;
  symbol: string;
  analysis: MarketAnalysis;
  signal: StrategySignal;
  trade: ProposedTrade | null;
  rationale: string;
}

const SIZE_RISK_PCT = 0.01;

function sizeQty(equity: number, entry: number, stop: number, maxPositionPct = 0.2) {
  const perShare = Math.max(entry - stop, 0.01);
  const byRisk = Math.floor((equity * SIZE_RISK_PCT) / perShare);
  const bySize = Math.floor((equity * maxPositionPct) / entry);
  return Math.max(1, Math.min(byRisk, bySize));
}

/** Builds what the agent proposes. The Risk Governor decides separately. */
export function planAgentRun(mode: AgentMode, equity: number): AgentPlan {
  if (mode === "A") {
    const symbol = "AMZN";
    const analysis = analyzeMarket(computeIndicators(getStock(symbol).history));
    const signal = runStrategy("meanrev", symbol);
    const qty = sizeQty(equity, signal.entry, signal.stopLoss, 0.12);
    return {
      mode,
      symbol,
      analysis: { ...analysis, strategy: "meanrev" },
      signal: { ...signal, signal: "BUY" },
      trade: { symbol, side: "BUY", qty, entryPrice: signal.entry, stopLoss: signal.stopLoss, takeProfit: signal.takeProfit, strategy: "meanrev" },
      rationale: `Scenario A: ${symbol} dipped below its 20-day mean in a range-bound market. The agent sizes the position so only ~1% of equity is at risk, with a stop-loss ${(((signal.entry - signal.stopLoss) / signal.entry) * 100).toFixed(1)}% below entry.`,
    };
  }

  if (mode === "B") {
    const symbol = "NVDA";
    const ind = computeIndicators(getStock(symbol).history);
    const analysis = analyzeMarket(ind);
    const base = runStrategy("trend", symbol);
    const stop = Math.round((base.entry - 6 * ind.atr14) * 100) / 100;
    const qty = Math.floor((equity * 0.45) / base.entry);
    return {
      mode,
      symbol,
      analysis: { ...analysis, strategy: "trend", riskLevel: "High" },
      signal: { ...base, signal: "BUY", stopLoss: stop, confidence: Math.min(base.confidence + 12, 91) },
      trade: { symbol, side: "BUY", qty, entryPrice: base.entry, stopLoss: stop, takeProfit: base.takeProfit, strategy: "trend" },
      rationale: `Scenario B: strong ${symbol} momentum pushed the signal generator to propose an aggressive position (~45% of equity) with a very wide stop. The Risk Governor must catch this.`,
    };
  }

  // Agent scan: evaluate every demo stock, pick the best BUY setup.
  let best: AgentPlan | null = null;
  for (const s of STOCKS) {
    const analysis = analyzeMarket(computeIndicators(s.history));
    const strat = analysis.strategy === "manual" ? "trend" : analysis.strategy;
    const signal = runStrategy(strat, s.symbol);
    if (signal.signal !== "BUY") continue;
    if (!best || signal.confidence > best.signal.confidence) {
      const qty = sizeQty(equity, signal.entry, signal.stopLoss);
      best = {
        mode,
        symbol: s.symbol,
        analysis,
        signal,
        trade: { symbol: s.symbol, side: "BUY", qty, entryPrice: signal.entry, stopLoss: signal.stopLoss, takeProfit: signal.takeProfit, strategy: strat },
        rationale: `Agent scanned ${STOCKS.length} demo stocks. ${s.symbol} produced the strongest simulated signal (${signal.confidence}/100) under ${strat === "trend" ? "trend following" : "mean reversion"}. ${signal.explanation}`,
      };
    }
  }
  if (best) return best;
  const s = at(STOCKS, 0);
  const analysis = analyzeMarket(computeIndicators(s.history));
  return {
    mode,
    symbol: s.symbol,
    analysis,
    signal: runStrategy("trend", s.symbol),
    trade: null,
    rationale: "Agent scanned all demo stocks and found no setup meeting its rules. Decision: HOLD — no trade proposed.",
  };
}
