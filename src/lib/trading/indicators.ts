import { at } from "./market-data";
import type { PricePoint, StrategyId } from "./types";

export function sma(values: number[], period: number): number {
  const slice = values.slice(-period);
  return slice.reduce((a, b) => a + b, 0) / slice.length;
}

export function smaSeries(values: number[], period: number): (number | null)[] {
  return values.map((_, i) =>
    i + 1 < period ? null : values.slice(i + 1 - period, i + 1).reduce((a, b) => a + b, 0) / period,
  );
}

export function rsi(values: number[], period = 14): number {
  const slice = values.slice(-(period + 1));
  let gains = 0;
  let losses = 0;
  for (let i = 1; i < slice.length; i++) {
    const d = at(slice, i) - at(slice, i - 1);
    if (d > 0) gains += d;
    else losses -= d;
  }
  if (losses === 0) return 100;
  const rs = gains / period / (losses / period);
  return 100 - 100 / (1 + rs);
}

/** Average absolute daily move — a close-only ATR proxy. */
export function atr(values: number[], period = 14): number {
  const slice = values.slice(-(period + 1));
  let sum = 0;
  for (let i = 1; i < slice.length; i++) sum += Math.abs(at(slice, i) - at(slice, i - 1));
  return sum / (slice.length - 1);
}

/** Annualised volatility, %. */
export function volatility(values: number[], period = 20): number {
  const slice = values.slice(-(period + 1));
  const rets = slice.slice(1).map((v, i) => Math.log(v / at(slice, i)));
  const mean = rets.reduce((a, b) => a + b, 0) / rets.length;
  const variance = rets.reduce((a, b) => a + (b - mean) ** 2, 0) / rets.length;
  return Math.sqrt(variance) * Math.sqrt(252) * 100;
}

export function zScore(values: number[], period = 20): number {
  const slice = values.slice(-period);
  const mean = slice.reduce((a, b) => a + b, 0) / slice.length;
  const sd = Math.sqrt(slice.reduce((a, b) => a + (b - mean) ** 2, 0) / slice.length);
  return sd === 0 ? 0 : (at(values, -1) - mean) / sd;
}

export interface Indicators {
  price: number;
  sma20: number;
  sma50: number;
  rsi14: number;
  atr14: number;
  vol20: number;
  z20: number;
  change30Pct: number;
  avgVolume: number;
}

export function computeIndicators(history: PricePoint[]): Indicators {
  const closes = history.map((p) => p.close);
  const price = at(closes, -1);
  const p30 = at(closes, -31);
  return {
    price,
    sma20: sma(closes, 20),
    sma50: sma(closes, 50),
    rsi14: rsi(closes, 14),
    atr14: atr(closes, 14),
    vol20: volatility(closes, 20),
    z20: zScore(closes, 20),
    change30Pct: ((price - p30) / p30) * 100,
    avgVolume: history.slice(-20).reduce((a, b) => a + b.volume, 0) / 20,
  };
}

export type Trend = "Uptrend" | "Downtrend" | "Sideways";
export type RiskLevel = "Low" | "Moderate" | "High";

export interface MarketAnalysis {
  trend: Trend;
  condition: string;
  opportunity: string;
  strategy: StrategyId;
  riskLevel: RiskLevel;
  explanation: string;
}

/** Simulated AI read of demo indicators. Rules-based; not investment advice. */
export function analyzeMarket(ind: Indicators): MarketAnalysis {
  const spread = ((ind.sma20 - ind.sma50) / ind.sma50) * 100;
  const trend: Trend = spread > 1.2 && ind.price > ind.sma20 ? "Uptrend" : spread < -1.2 && ind.price < ind.sma20 ? "Downtrend" : "Sideways";
  const riskLevel: RiskLevel = ind.vol20 > 40 ? "High" : ind.vol20 > 24 ? "Moderate" : "Low";

  let condition: string;
  if (ind.rsi14 > 70) condition = "Overbought — momentum stretched";
  else if (ind.rsi14 < 30) condition = "Oversold — selling pressure stretched";
  else if (trend === "Sideways") condition = "Range-bound consolidation";
  else condition = `Healthy ${trend.toLowerCase()} with ${riskLevel.toLowerCase()} volatility`;

  const strategy: StrategyId = trend === "Sideways" || Math.abs(ind.z20) > 1.6 ? "meanrev" : "trend";

  let opportunity: string;
  if (strategy === "trend" && trend === "Uptrend") opportunity = "Trend continuation long on pullbacks toward the 20-day average";
  else if (strategy === "trend" && trend === "Downtrend") opportunity = "No long setup — trend is down; agent stays flat (long-only demo)";
  else if (ind.z20 < -1) opportunity = "Mean-reversion long: price stretched below its 20-day mean";
  else if (ind.z20 > 1) opportunity = "Stretched above mean — wait for reversion before entering";
  else opportunity = "No clear edge — price near fair value within its range";

  const explanation =
    `The 20-day average is ${spread >= 0 ? "above" : "below"} the 50-day by ${Math.abs(spread).toFixed(1)}%, ` +
    `RSI(14) reads ${ind.rsi14.toFixed(0)} and price sits ${Math.abs(ind.z20).toFixed(1)} standard deviations ` +
    `${ind.z20 >= 0 ? "above" : "below"} its 20-day mean. Annualised volatility of ${ind.vol20.toFixed(0)}% ` +
    `puts risk at ${riskLevel.toLowerCase()}. The agent therefore favours ${strategy === "trend" ? "trend following" : "mean reversion"}.`;

  return { trend, condition, opportunity, strategy, riskLevel, explanation };
}
