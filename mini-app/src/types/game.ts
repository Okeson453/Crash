/**
 * Game-specific type definitions
 */

export type GamePhase =
  | 'idle'
  | 'waiting'
  | 'countdown'
  | 'running'
  | 'crashed'
  | 'cashed_out'
  | 'paused'
  | 'error';

export interface MultiplierTick {
  roundId: string;
  multiplier: number;
  timestamp: string;
}

export interface RoundHistoryItem {
  roundId: string;
  crashPoint: number;
  timestamp: string;
  myBet?: {
    amount: number;
    cashoutMultiplier: number | null;
    pnl: number | null;
  } | null;
}

export interface LiveFeedItem {
  id: string;
  type: 'bet' | 'cashout' | 'system';
  username: string;
  amount?: number;
  multiplier?: number;
  pnl?: number;
  message: string;
  timestamp: string;
}

export interface BetLimits {
  min: number;
  max: number;
  step: number;
}

export interface PresetAmount {
  label: string;
  value: number;
}

export interface CashoutResult {
  success: boolean;
  multiplier: number;
  pnl: number;
  error?: string;
}

export type GameUIState =
  | 'CONNECTING'
  | 'WAITING'
  | 'BETTING_OPEN'
  | 'BET_PLACED'
  | 'ROUND_RUNNING'
  | 'CASHOUT_AVAILABLE'
  | 'CASHED_OUT'
  | 'CRASHED'
  | 'BET_FAILED'
  | 'RECONNECTING'
  | 'DISCONNECTED'
  | 'MAINTENANCE';
