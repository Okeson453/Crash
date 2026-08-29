/**
 * Bet-specific type definitions
 */

export type BetStatus =
  | 'pending'
  | 'placed'
  | 'active'
  | 'cashed_out'
  | 'lost'
  | 'cancelled'
  | 'failed';

export interface BetFilters {
  status?: BetStatus | BetStatus[];
  fromDate?: string;
  toDate?: string;
  minAmount?: number;
  maxAmount?: number;
}

export interface BetHistoryItem {
  id: string;
  roundId: string | null;
  roundNumber?: number;
  amount: number;
  autoCashout: number | null;
  state: BetStatus;
  cashoutMultiplier: number | null;
  pnl: number | null;
  createdAt: string;
  settledAt: string | null;
}

export interface LedgerEntry {
  id: string;
  type: 'bet' | 'win' | 'loss' | 'deposit' | 'withdrawal' | 'bonus' | 'fee';
  amount: number;
  balanceBefore: number;
  balanceAfter: number;
  description: string;
  referenceId: string | null;
  createdAt: string;
}
