import { computeIndicators } from "./indicators";
import { getStock } from "./market-data";
import type { StrategyId } from "./types";

export interface StrategyInfo {
  id: Exclude<StrategyId, "manual">;
  name: string;
  short: string;
  description: string;
  usefulWhen: string[];
  riskLevel: "Low" | "Moderate" | "High";
  /** Sample (backtest-style) demo stats. */
  sample: { winRate: number; avgReturn: number; trades: number; maxDrawdown: number };
  curve: number[];
}

export const STRATEGIES: StrategyInfo[] = [
  {
    id: "trend",
    name: "Moving Average Trend Following",
    short: "Trend Following",
    description:
      "Buys when the 20-day moving average is above the 50-day and price confirms above the 20-day. Rides persistent moves and exits on a trailing stop.",
    usefulWhen: ["Strong directional markets", "Rising momentum and volume", "Low-to-moderate volatility"],
    riskLevel: "Moderate",
    sample: { winRate: 46, avgReturn: 2.8, trades: 64, maxDrawdown: -8.4 },
    curve: [100, 101, 100.4, 102.6, 104, 103.2, 106.1, 108.3, 107.5, 110.2, 112.8, 111.9, 114.6],
  },
  {
    id: "meanrev",
    name: "Mean Reversion",
    short: "Mean Reversion",
    description:
      "Buys when price stretches well below its 20-day mean (z-score < −1 and RSI under 40), targeting a return to the average with a tight stop.",
    usefulWhen: ["Range-bound, sideways markets", "Short-term overreactions", "Stable fundamentals"],
    riskLevel: "Low",
    sample: { winRate: 61, avgReturn: 1.3, trades: 92, maxDrawdown: -5.1 },
    curve: [100, 100.8, 101.5, 101.1, 102.3, 103, 102.6, 103.8, 104.5, 104.1, 105.4, 106.2, 106.9],
  },
];

export interface StrategySignal {
  signal: "BUY" | "SELL" | "HOLD";
  /** Simulated model output (0–100). Not a probability of profit. */
  confidence: number;
  entry: number;
  stopLoss: number;
  takeProfit: number;
  explanation: string;
  facts: { label: string; value: string }[];
}

const clamp = (v: number, a: number, b: number) => Math.min(b, Math.max(a, v));
const r2 = (v: number) => Math.round(v * 100) / 100;

export function runStrategy(id: Exclude<StrategyId, "manual">, symbol: string): StrategySignal {
  const ind = computeIndicators(getStock(symbol).history);
  const entry = ind.price;

  if (id === "trend") {
    const spread = ((ind.sma20 - ind.sma50) / ind.sma50) * 100;
    const above = ind.price > ind.sma20;
    const signal = spread > 0.8 && above ? "BUY" : spread < -0.8 && !above ? "SELL" : "HOLD";
    const confidence = Math.round(clamp(45 + Math.abs(spread) * 6 + (above ? 6 : 0) - ind.vol20 / 6, 18, 88));
    const explanation =
      signal === "BUY"
        ? `The 20-day average (${ind.sma20.toFixed(2)}) is ${spread.toFixed(1)}% above the 50-day (${ind.sma50.toFixed(2)}) and price is trading above both — a bullish trend structure.`
        : signal === "SELL"
          ? `The 20-day average is ${Math.abs(spread).toFixed(1)}% below the 50-day with price under both. Trend is down; the strategy would exit or avoid longs.`
          : `Moving averages are within ${Math.abs(spread).toFixed(1)}% of each other — no confirmed trend, so the strategy holds.`;
    return {
      signal,
      confidence,
      entry: r2(entry),
      stopLoss: r2(entry - 2 * ind.atr14),
      takeProfit: r2(entry + 4 * ind.atr14),
      explanation,
      facts: [
        { label: "SMA 20", value: ind.sma20.toFixed(2) },
        { label: "SMA 50", value: ind.sma50.toFixed(2) },
        { label: "MA spread", value: `${spread.toFixed(2)}%` },
        { label: "ATR 14", value: ind.atr14.toFixed(2) },
      ],
    };
  }

  const signal = ind.z20 < -1 && ind.rsi14 < 45 ? "BUY" : ind.z20 > 1.2 && ind.rsi14 > 60 ? "SELL" : "HOLD";
  const confidence = Math.round(clamp(40 + Math.abs(ind.z20) * 18 + Math.abs(50 - ind.rsi14) / 2 - ind.vol20 / 8, 15, 86));
  const explanation =
    signal === "BUY"
      ? `Price is ${Math.abs(ind.z20).toFixed(1)} standard deviations below its 20-day mean with RSI at ${ind.rsi14.toFixed(0)} — a stretched move the strategy expects to revert toward ${ind.sma20.toFixed(2)}.`
      : signal === "SELL"
        ? `Price is ${ind.z20.toFixed(1)} standard deviations above its mean with RSI ${ind.rsi14.toFixed(0)} — stretched to the upside; the strategy would take profits rather than buy.`
        : `Price is within ${Math.abs(ind.z20).toFixed(1)} standard deviations of its mean — no stretch to fade, so the strategy holds.`;
  return {
    signal,
    confidence,
    entry: r2(entry),
    stopLoss: r2(entry - 1.5 * ind.atr14),
    takeProfit: r2(Math.max(ind.sma20, entry + 1.5 * ind.atr14)),
    explanation,
    facts: [
      { label: "Z-score 20", value: ind.z20.toFixed(2) },
      { label: "RSI 14", value: ind.rsi14.toFixed(1) },
      { label: "Mean (SMA 20)", value: ind.sma20.toFixed(2) },
      { label: "ATR 14", value: ind.atr14.toFixed(2) },
    ],
  };
}
