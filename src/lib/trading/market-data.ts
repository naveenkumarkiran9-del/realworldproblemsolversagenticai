import type { PricePoint, Stock } from "./types";

/**
 * DEMO DATA ONLY. Deterministic synthetic price series — not live market data.
 * A seeded generator keeps server and browser renders identical.
 */
function mulberry32(seed: number) {
  let a = seed;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Fixed demo calendar ending on a fixed date (weekdays only). */
const DEMO_END = Date.UTC(2026, 10, 6);
const DAYS = 120;

function tradingDates(n: number): string[] {
  const out: string[] = [];
  let t = DEMO_END;
  while (out.length < n) {
    const d = new Date(t);
    const wd = d.getUTCDay();
    if (wd !== 0 && wd !== 6) out.unshift(d.toISOString().slice(0, 10));
    t -= 86400000;
  }
  return out;
}

const DATES = tradingDates(DAYS);

interface Profile {
  symbol: string;
  name: string;
  sector: string;
  seed: number;
  start: number;
  drift: number;
  vol: number;
  /** Pull toward the start price (creates range-bound behaviour). */
  revert: number;
  baseVolume: number;
  /** Late shock applied over the final days, to create setups. */
  tailShock?: number;
}

const PROFILES: Profile[] = [
  { symbol: "AAPL", name: "Apple Inc.", sector: "Technology", seed: 11, start: 178, drift: 0.0011, vol: 0.013, revert: 0, baseVolume: 58_000_000 },
  { symbol: "MSFT", name: "Microsoft Corp.", sector: "Technology", seed: 23, start: 392, drift: 0.0013, vol: 0.011, revert: 0, baseVolume: 24_000_000 },
  { symbol: "NVDA", name: "NVIDIA Corp.", sector: "Semiconductors", seed: 37, start: 112, drift: 0.0032, vol: 0.026, revert: 0, baseVolume: 310_000_000 },
  { symbol: "TSLA", name: "Tesla Inc.", sector: "Automotive", seed: 41, start: 268, drift: -0.0016, vol: 0.031, revert: 0, baseVolume: 96_000_000 },
  { symbol: "AMZN", name: "Amazon.com Inc.", sector: "Consumer", seed: 53, start: 186, drift: 0, vol: 0.016, revert: 0.08, baseVolume: 44_000_000, tailShock: -0.012 },
  { symbol: "GOOGL", name: "Alphabet Inc.", sector: "Communication", seed: 67, start: 164, drift: 0.0008, vol: 0.015, revert: 0.02, baseVolume: 27_000_000 },
  { symbol: "META", name: "Meta Platforms", sector: "Communication", seed: 79, start: 512, drift: 0.0018, vol: 0.02, revert: 0, baseVolume: 15_000_000 },
  { symbol: "JPM", name: "JPMorgan Chase", sector: "Financials", seed: 83, start: 214, drift: 0.0004, vol: 0.011, revert: 0.05, baseVolume: 9_000_000 },
];

function generate(p: Profile): PricePoint[] {
  const rand = mulberry32(p.seed);
  const gauss = () => {
    const u = Math.max(rand(), 1e-9);
    const v = rand();
    return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
  };
  let price = p.start;
  return DATES.map((date, i) => {
    const pull = p.revert * Math.log(p.start / price);
    const shock = p.tailShock && i > DAYS - 6 ? p.tailShock : 0;
    const ret = p.drift + pull + shock + p.vol * gauss();
    price = Math.max(5, price * Math.exp(ret));
    const volume = Math.round(p.baseVolume * (0.7 + rand() * 0.6 + Math.abs(ret) * 12));
    return { date, close: Math.round(price * 100) / 100, volume };
  });
}

export const STOCKS: Stock[] = PROFILES.map((p) => ({
  symbol: p.symbol,
  name: p.name,
  sector: p.sector,
  history: generate(p),
}));

export const DEMO_AS_OF = at(DATES, -1);

/** Index into a list that must contain the item (negative counts from the end). */
export function at<T>(arr: readonly T[], i: number): T {
  const v = arr[i < 0 ? arr.length + i : i];
  if (v === undefined) throw new Error(`Index ${i} out of range (length ${arr.length})`);
  return v;
}

export function getStock(symbol: string): Stock {
  const s = STOCKS.find((x) => x.symbol === symbol);
  if (!s) throw new Error(`Unknown demo symbol ${symbol}`);
  return s;
}

export function isDemoSymbol(symbol: string): boolean {
  return STOCKS.some((x) => x.symbol === symbol);
}

export function lastPrice(symbol: string): number {
  return at(getStock(symbol).history, -1).close;
}

export function dayChange(symbol: string): { abs: number; pct: number } {
  const h = getStock(symbol).history;
  const a = at(h, -1).close;
  const b = at(h, -2).close;
  return { abs: a - b, pct: ((a - b) / b) * 100 };
}

export const PRICE_MAP: Readonly<Record<string, number>> = Object.fromEntries(
  STOCKS.map((s) => [s.symbol, at(s.history, -1).close]),
);

/**
 * Current demo price for a symbol. Unknown symbols return NaN, which the
 * Risk Governor rejects as invalid input and the UI shows as "—".
 */
export function priceOf(symbol: string): number {
  return PRICE_MAP[symbol] ?? Number.NaN;
}

/** Synthetic equity curve (demo) ending at the supplied current equity. */
export function equityCurve(currentEquity: number, start = 100_000) {
  const rand = mulberry32(991);
  const n = 60;
  const raw: number[] = [start];
  for (let i = 1; i < n; i++) raw.push(at(raw, i - 1) * (1 + 0.0009 + (rand() - 0.5) * 0.012));
  const scale = (currentEquity - start) / (at(raw, n - 1) - start || 1);
  const dates = DATES.slice(-n);
  return raw.map((v, i) => ({
    date: at(dates, i),
    value: Math.round(i === n - 1 ? currentEquity : start + (v - start) * scale),
  }));
}
