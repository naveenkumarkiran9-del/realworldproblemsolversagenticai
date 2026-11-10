import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { at, getStock, PRICE_MAP, priceOf } from "./market-data";
import { DEFAULT_LIMITS, evaluateTrade, exposure, portfolioEquity } from "./risk";
import type { JournalEntry, Position, ProposedTrade, RiskEvaluation, RiskLimits, StrategyId } from "./types";

export const STARTING_CAPITAL = 100_000;
const STORAGE_KEY = "tradepilot-demo-v1";

interface DemoState {
  cash: number;
  positions: Position[];
  journal: JournalEntry[];
  limits: RiskLimits;
  killSwitch: boolean;
  lastEvaluation: { trade: ProposedTrade; evaluation: RiskEvaluation; at: string } | null;
  nextId: number;
}

export interface DraftOrder {
  symbol: string;
  qty?: number;
  entryPrice: number;
  stopLoss: number;
  takeProfit: number;
  strategy: StrategyId;
}

/* ---------- Seeded demo history ---------- */

const closeAt = (symbol: string, back: number) => {
  const h = getStock(symbol).history;
  return at(h, h.length - 1 - back);
};

interface Seed {
  symbol: string;
  strategy: StrategyId;
  qty: number;
  entryBack: number;
  exitBack?: number;
  why: string;
}

const SEEDS: Seed[] = [
  { symbol: "MSFT", strategy: "trend", qty: 25, entryBack: 70, exitBack: 52, why: "20/50-day crossover confirmed with rising volume." },
  { symbol: "AMZN", strategy: "meanrev", qty: 60, entryBack: 64, exitBack: 58, why: "Price stretched 1.8σ below its 20-day mean." },
  { symbol: "TSLA", strategy: "trend", qty: 30, entryBack: 55, exitBack: 47, why: "Short-lived breakout above the 20-day average." },
  { symbol: "NVDA", strategy: "trend", qty: 80, entryBack: 50, exitBack: 31, why: "Strong uptrend; price held above both moving averages." },
  { symbol: "JPM", strategy: "meanrev", qty: 40, entryBack: 42, exitBack: 36, why: "Oversold reading (RSI 31) in a stable range." },
  { symbol: "GOOGL", strategy: "meanrev", qty: 50, entryBack: 34, exitBack: 27, why: "Pullback to lower band in sideways market." },
  { symbol: "META", strategy: "trend", qty: 12, entryBack: 28, exitBack: 19, why: "Higher highs with 20-day average sloping up." },
  { symbol: "AAPL", strategy: "trend", qty: 40, entryBack: 15, why: "Trend continuation entry after a shallow pullback." },
  { symbol: "MSFT", strategy: "trend", qty: 18, entryBack: 9, why: "Persistent uptrend with low volatility." },
];

function seedState(): DemoState {
  const journal: JournalEntry[] = [];
  const positions: Position[] = [];
  let cash = STARTING_CAPITAL;
  SEEDS.forEach((s, i) => {
    const id = `T-${1001 + i}`;
    const entry = closeAt(s.symbol, s.entryBack);
    const exit = s.exitBack !== undefined ? closeAt(s.symbol, s.exitBack) : null;
    const stop = Math.round(entry.close * 0.95 * 100) / 100;
    const tp = Math.round(entry.close * 1.1 * 100) / 100;
    const pnl = exit ? Math.round((exit.close - entry.close) * s.qty * 100) / 100 : null;
    if (exit) cash += pnl as number;
    else {
      cash -= entry.close * s.qty;
      positions.push({ id, symbol: s.symbol, qty: s.qty, entryPrice: entry.close, stopLoss: stop, takeProfit: tp, strategy: s.strategy, openedAt: `${entry.date}T14:30:00.000Z` });
    }
    journal.push({
      id,
      timestamp: `${entry.date}T14:30:00.000Z`,
      symbol: s.symbol,
      side: "BUY",
      strategy: s.strategy,
      entryPrice: entry.close,
      exitPrice: exit?.close ?? null,
      qty: s.qty,
      stopLoss: stop,
      takeProfit: tp,
      pnl,
      status: exit ? "Closed" : "Open",
      decision: "Accepted",
      aiExplanation: s.why,
      riskResult: "Approved — all 8 risk checks passed.",
      checks: [],
      closedAt: exit ? `${exit.date}T20:00:00.000Z` : null,
      source: "AI Agent",
    });
  });
  // Seeded rejections
  const tsla = closeAt("TSLA", 22);
  journal.push({
    id: "T-1010",
    timestamp: `${tsla.date}T15:10:00.000Z`,
    symbol: "TSLA",
    side: "BUY",
    strategy: "trend",
    entryPrice: tsla.close,
    exitPrice: null,
    qty: 150,
    stopLoss: null,
    takeProfit: null,
    pnl: null,
    status: "Rejected",
    decision: "Rejected",
    aiExplanation: "Momentum spike detected, but signal quality was low in a falling trend.",
    riskResult: "Trade rejected: the trade does not have a valid stop-loss.",
    checks: [],
    closedAt: null,
    source: "AI Agent",
  });
  const nvda = closeAt("NVDA", 6);
  journal.push({
    id: "T-1011",
    timestamp: `${nvda.date}T16:05:00.000Z`,
    symbol: "NVDA",
    side: "BUY",
    strategy: "trend",
    entryPrice: nvda.close,
    exitPrice: null,
    qty: 300,
    stopLoss: Math.round(nvda.close * 0.85 * 100) / 100,
    takeProfit: null,
    pnl: null,
    status: "Rejected",
    decision: "Rejected",
    aiExplanation: "Aggressive sizing proposed on a strong trend.",
    riskResult: "Trade rejected: proposed position exceeds the configured risk limit.",
    checks: [],
    closedAt: null,
    source: "AI Agent",
  });
  return {
    cash: Math.round(cash * 100) / 100,
    positions,
    journal: journal.reverse(),
    limits: DEFAULT_LIMITS,
    killSwitch: false,
    lastEvaluation: null,
    nextId: 1012,
  };
}

/* ---------- Context ---------- */

export interface SubmitMeta {
  source: JournalEntry["source"];
  aiExplanation: string;
}

interface TradingContextValue extends DemoState {
  prices: Record<string, number>;
  equity: number;
  invested: number;
  totalPnl: number;
  realizedPnl: number;
  unrealizedPnl: number;
  dailyLoss: number;
  winRate: number;
  tradeCount: number;
  draft: DraftOrder | null;
  setDraft: (d: DraftOrder | null) => void;
  submitTrade: (trade: ProposedTrade, meta: SubmitMeta) => { evaluation: RiskEvaluation; entryId: string };
  previewTrade: (trade: ProposedTrade) => RiskEvaluation;
  closePosition: (positionId: string) => RiskEvaluation;
  setLimits: (l: RiskLimits) => void;
  setKillSwitch: (on: boolean) => void;
  resetDemo: () => void;
}

const TradingContext = createContext<TradingContextValue | null>(null);

const isToday = (iso: string | null) => {
  if (!iso) return false;
  const d = new Date(iso);
  const n = new Date();
  return d.getFullYear() === n.getFullYear() && d.getMonth() === n.getMonth() && d.getDate() === n.getDate();
};

export function TradingProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<DemoState>(seedState);
  const [draft, setDraft] = useState<DraftOrder | null>(null);
  const loaded = useRef(false);
  const stateRef = useRef(state);
  stateRef.current = state;

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      if (raw) setState({ ...seedState(), ...(JSON.parse(raw) as DemoState) });
    } catch {
      /* ignore corrupt demo storage */
    }
    loaded.current = true;
  }, []);

  useEffect(() => {
    if (!loaded.current) return;
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  }, [state]);

  const prices = PRICE_MAP;

  const dailyLossOf = (s: DemoState) => {
    const net = s.journal.filter((j) => isToday(j.closedAt) && j.pnl !== null).reduce((a, j) => a + (j.pnl as number), 0);
    return Math.max(0, -net);
  };

  const snapshot = (s: DemoState) => ({ cash: s.cash, positions: s.positions, prices, dailyLoss: dailyLossOf(s), killSwitch: s.killSwitch });

  const previewTrade = useCallback((trade: ProposedTrade) => evaluateTrade(trade, snapshot(stateRef.current), stateRef.current.limits), []); // eslint-disable-line react-hooks/exhaustive-deps

  const submitTrade = useCallback((trade: ProposedTrade, meta: SubmitMeta) => {
    const s = stateRef.current;
    const evaluation = evaluateTrade(trade, snapshot(s), s.limits);
    const now = new Date().toISOString();
    const id = `T-${s.nextId}`;
    const next: DemoState = { ...s, nextId: s.nextId + 1, lastEvaluation: { trade, evaluation, at: now } };
    const passedCount = evaluation.checks.filter((c) => c.passed).length;
    const riskResult = evaluation.approved ? `Approved — all ${evaluation.checks.length} risk checks passed.` : `${evaluation.explanation} (${passedCount}/${evaluation.checks.length} checks passed)`;

    if (!evaluation.approved) {
      next.journal = [
        { id, timestamp: now, symbol: trade.symbol, side: trade.side, strategy: trade.strategy, entryPrice: trade.entryPrice, exitPrice: null, qty: trade.qty, stopLoss: trade.stopLoss, takeProfit: trade.takeProfit, pnl: null, status: "Rejected", decision: "Rejected", aiExplanation: meta.aiExplanation, riskResult, checks: evaluation.checks, closedAt: null, source: meta.source },
        ...s.journal,
      ];
    } else if (trade.side === "BUY") {
      next.cash = Math.round((s.cash - trade.qty * trade.entryPrice) * 100) / 100;
      next.positions = [...s.positions, { id, symbol: trade.symbol, qty: trade.qty, entryPrice: trade.entryPrice, stopLoss: trade.stopLoss, takeProfit: trade.takeProfit, strategy: trade.strategy, openedAt: now }];
      next.journal = [
        { id, timestamp: now, symbol: trade.symbol, side: "BUY", strategy: trade.strategy, entryPrice: trade.entryPrice, exitPrice: null, qty: trade.qty, stopLoss: trade.stopLoss, takeProfit: trade.takeProfit, pnl: null, status: "Open", decision: "Accepted", aiExplanation: meta.aiExplanation, riskResult, checks: evaluation.checks, closedAt: null, source: meta.source },
        ...s.journal,
      ];
    } else {
      // SELL: close lots FIFO, splitting partially-closed lots into their own closed journal rows.
      let remaining = trade.qty;
      let positions = [...s.positions];
      let journal = [...s.journal];
      let part = 0;
      for (const lot of s.positions.filter((p) => p.symbol === trade.symbol)) {
        if (remaining <= 0) break;
        const q = Math.min(remaining, lot.qty);
        remaining -= q;
        const pnl = Math.round((trade.entryPrice - lot.entryPrice) * q * 100) / 100;
        if (q === lot.qty) {
          positions = positions.filter((p) => p.id !== lot.id);
          journal = journal.map((j) => (j.id === lot.id ? { ...j, exitPrice: trade.entryPrice, pnl, status: "Closed", closedAt: now, riskResult: `${j.riskResult} Exit approved.` } : j));
        } else {
          part += 1;
          positions = positions.map((p) => (p.id === lot.id ? { ...p, qty: p.qty - q } : p));
          const orig = journal.find((j) => j.id === lot.id);
          journal = journal.map((j) => (j.id === lot.id ? { ...j, qty: j.qty - q } : j));
          if (orig) {
            journal = [{ ...orig, id: `${lot.id}-P${part}-${s.nextId}`, qty: q, exitPrice: trade.entryPrice, pnl, status: "Closed", closedAt: now, riskResult: `Partial exit approved.` }, ...journal];
          }
        }
      }
      next.positions = positions;
      next.journal = journal;
      next.cash = Math.round((s.cash + trade.qty * trade.entryPrice) * 100) / 100;
    }
    setState(next);
    stateRef.current = next;
    return { evaluation, entryId: id };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const closePosition = useCallback(
    (positionId: string) => {
      const lot = stateRef.current.positions.find((p) => p.id === positionId);
      if (!lot) throw new Error("Position not found");
      return submitTrade(
        { symbol: lot.symbol, side: "SELL", qty: lot.qty, entryPrice: priceOf(lot.symbol), stopLoss: null, takeProfit: null, strategy: lot.strategy },
        { source: "Manual", aiExplanation: "Position closed manually at the current demo price." },
      ).evaluation;
    },
    [submitTrade, prices],
  );

  const value = useMemo<TradingContextValue>(() => {
    const equity = portfolioEquity({ cash: state.cash, positions: state.positions, prices });
    const invested = exposure({ positions: state.positions, prices });
    const closed = state.journal.filter((j) => j.status === "Closed" && j.pnl !== null);
    const realizedPnl = closed.reduce((a, j) => a + (j.pnl as number), 0);
    const unrealizedPnl = state.positions.reduce((a, p) => a + ((prices[p.symbol] ?? p.entryPrice) - p.entryPrice) * p.qty, 0);
    const wins = closed.filter((j) => (j.pnl as number) > 0).length;
    return {
      ...state,
      prices,
      equity,
      invested,
      totalPnl: equity - STARTING_CAPITAL,
      realizedPnl,
      unrealizedPnl,
      dailyLoss: dailyLossOf(state),
      winRate: closed.length ? (wins / closed.length) * 100 : 0,
      tradeCount: state.journal.filter((j) => j.decision === "Accepted").length,
      draft,
      setDraft,
      submitTrade,
      previewTrade,
      closePosition,
      setLimits: (limits) => setState((s) => ({ ...s, limits })),
      setKillSwitch: (on) => setState((s) => ({ ...s, killSwitch: on })),
      resetDemo: () => {
        const fresh = seedState();
        stateRef.current = fresh;
        setState(fresh);
        setDraft(null);
      },
    };
  }, [state, draft, prices, submitTrade, previewTrade, closePosition]); // eslint-disable-line react-hooks/exhaustive-deps

  return <TradingContext.Provider value={value}>{children}</TradingContext.Provider>;
}

export function useTrading() {
  const ctx = useContext(TradingContext);
  if (!ctx) throw new Error("useTrading must be used inside TradingProvider");
  return ctx;
}
