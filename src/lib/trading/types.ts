export type StrategyId = "trend" | "meanrev" | "manual";

export interface PricePoint {
  date: string;
  close: number;
  volume: number;
}

export interface Stock {
  symbol: string;
  name: string;
  sector: string;
  history: PricePoint[];
}

export interface RiskLimits {
  /** Max loss to stop-loss per trade, as % of portfolio equity. */
  maxRiskPerTradePct: number;
  /** Max realized loss per day, as % of portfolio equity. */
  maxDailyLossPct: number;
  /** Max total invested capital, as % of portfolio equity. */
  maxExposurePct: number;
  /** Max value of a single symbol position, as % of portfolio equity. */
  maxPositionSizePct: number;
  /** Every buy must carry a valid stop-loss below entry. */
  requireStopLoss: boolean;
}

export interface Position {
  /** Journal entry id this lot belongs to. */
  id: string;
  symbol: string;
  qty: number;
  entryPrice: number;
  stopLoss: number | null;
  takeProfit: number | null;
  strategy: StrategyId;
  openedAt: string;
}

export interface ProposedTrade {
  symbol: string;
  side: "BUY" | "SELL";
  qty: number;
  entryPrice: number;
  stopLoss: number | null;
  takeProfit: number | null;
  strategy: StrategyId;
}

export interface RiskCheck {
  id: string;
  label: string;
  passed: boolean;
  detail: string;
}

export interface RiskEvaluation {
  approved: boolean;
  checks: RiskCheck[];
  explanation: string;
}

export type TradeStatus = "Open" | "Closed" | "Rejected";

export interface JournalEntry {
  id: string;
  timestamp: string;
  symbol: string;
  side: "BUY" | "SELL";
  strategy: StrategyId;
  entryPrice: number;
  exitPrice: number | null;
  qty: number;
  stopLoss: number | null;
  takeProfit: number | null;
  pnl: number | null;
  status: TradeStatus;
  decision: "Accepted" | "Rejected";
  aiExplanation: string;
  riskResult: string;
  checks: RiskCheck[];
  closedAt: string | null;
  source: "Manual" | "AI Agent" | "Scenario A" | "Scenario B";
}

export const STRATEGY_NAMES: Record<StrategyId, string> = {
  trend: "Moving Average Trend Following",
  meanrev: "Mean Reversion",
  manual: "Manual (User)",
};
