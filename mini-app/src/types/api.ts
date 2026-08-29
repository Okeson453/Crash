/**
 * API type definitions shared across the Mini App
 */

export interface ApiError {
  error: {
    code: string;
    message: string;
    requestId?: string;
  };
}

export interface ApiResponse<T> {
  data: T;
  meta?: {
    requestId: string;
    timestamp: string;
  };
}

export interface PaginatedResponse<T> {
  data: T[];
  pagination: {
    cursor: string | null;
    hasMore: boolean;
    total?: number;
  };
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
  expiresAt: number;
}

export interface TelegramAuthRequest {
  initData: string;
}

export interface TelegramAuthResponse {
  user: User;
  tokens: AuthTokens;
  isNewUser: boolean;
}

export interface RefreshTokenRequest {
  refreshToken: string;
}

export interface User {
  id: string;
  telegramId: string;
  telegramUsername: string | null;
  firstName: string;
  lastName: string | null;
  photoUrl: string | null;
  email: string | null;
  status: 'onboarding' | 'active' | 'suspended' | 'cancelled' | 'banned';
  role: 'player' | 'operator' | 'admin';
  planId: string | null;
  planName: string | null;
  timezone: string;
  createdAt: string;
  updatedAt: string;
}

export interface UserPreferences {
  defaultBetAmount: number;
  defaultAutoCashout: number | null;
  soundEnabled: boolean;
  hapticEnabled: boolean;
  animationsEnabled: boolean;
  theme: 'system' | 'light' | 'dark';
  language: string;
  notificationsEnabled: boolean;
  maxDailyLoss?: number | null;
  sessionLossLimit?: number | null;
  autoBet?: { enabled: boolean; strategy: 'repeat-last' | 'custom-sequence' | 'martingale' | 'anti-martingale' | 'fibonacci'; maxBet: number; stopAfterRounds?: number | null };
}

export interface UserStats {
  totalBets: number;
  totalWins: number;
  totalLosses: number;
  winRate: number;
  totalPnl: number;
  bestMultiplier: number;
  worstMultiplier: number;
  averageCashout: number;
  currentStreak: number;
  longestWinStreak: number;
  longestLossStreak: number;
}

export interface UserActivity {
  id: string;
  type: 'bet_placed' | 'bet_won' | 'bet_lost' | 'cashout' | 'deposit' | 'withdrawal' | 'bonus';
  amount: number | null;
  multiplier: number | null;
  roundId: string | null;
  description: string;
  createdAt: string;
}

export interface GameState {
  phase: 'idle' | 'waiting' | 'countdown' | 'running' | 'crashed' | 'paused' | 'error';
  roundId: string | null;
  multiplier: number | null;
  countdownSeconds: number | null;
  startedAt: string | null;
  crashedAt: string | null;
  crashPoint: number | null;
  nextRoundAt: string | null;
  serverTime: string;
}

export interface GameConfig {
  minBet: number;
  maxBet: number;
  betStep: number;
  countdownSeconds: number;
  maxMultiplier: number;
  houseEdge: number;
  currency: string;
  currencySymbol: string;
}

export interface Round {
  id: string;
  roundNumber: number;
  crashPoint: number;
  startedAt: string;
  crashedAt: string;
  totalBets: number;
  totalWagered: number;
  totalPaidOut: number;
  fairness: FairnessData | null;
}

export interface FairnessData {
  serverSeedHash: string;
  serverSeed: string | null;
  clientSeed: string;
  nonce: number;
  verified: boolean;
}

export interface Bet {
  id: string;
  roundId: string | null;
  amount: number;
  autoCashout: number | null;
  state: 'pending' | 'placed' | 'active' | 'cashed_out' | 'lost' | 'cancelled' | 'failed';
  cashoutMultiplier: number | null;
  pnl: number | null;
  createdAt: string;
  settledAt: string | null;
}

export interface PlaceBetRequest {
  amount: number;
  autoCashout?: number | null;
}

export interface CashoutResponse {
  betId: string;
  multiplier: number;
  pnl: number;
  balanceAfter: number;
}

export interface BalanceResponse {
  balance: number;
  currency: string;
  currencySymbol: string;
  updatedAt: string;
}

export interface AdminSessionState {
  status: 'idle' | 'running' | 'paused' | 'stopped' | 'error';
  mode: 'observe-only' | 'dry-run' | 'live' | 'maintenance';
  uptimeSeconds: number;
  totalRounds: number;
  totalBets: number;
  totalPnl: number;
  lastError: string | null;
  healthChecks: Array<{
    component: string;
    status: 'ok' | 'degraded' | 'failing';
    message: string;
  }>;
}

export interface AdminConfig {
  stakePerEntry: number;
  cashOutTarget: number;
  maxDailyEntries: number;
  mode: 'observe-only' | 'dry-run' | 'live' | 'maintenance';
}

export interface AuditLogEntry {
  id: string;
  actorType: string;
  actorId: string;
  action: string;
  targetUserId: string | null;
  payload: Record<string, unknown>;
  createdAt: string;
}

export interface AnalyticsOverview {
  period: string;
  totalPlayers: number;
  activePlayers: number;
  totalBets: number;
  totalWagered: number;
  totalPaidOut: number;
  houseProfit: number;
  averageBet: number;
  averageCashout: number;
  crashDistribution: Array<{ range: string; count: number; percentage: number }>;
}

export interface AnalyticsRevenue {
  labels: string[];
  revenue: number[];
  bets: number[];
  players: number[];
}

export interface HealthStatus {
  status: 'healthy' | 'degraded' | 'unhealthy';
  checks: Array<{
    name: string;
    status: 'ok' | 'degraded' | 'failing';
    responseTimeMs: number;
    message: string;
    lastChecked: string;
  }>;
  timestamp: string;
  version: string;
}

export type WebSocketEventType =
  | 'game:state'
  | 'game:countdown'
  | 'game:round-start'
  | 'game:multiplier'
  | 'game:round-end'
  | 'bet:placed'
  | 'bet:cashed-out'
  | 'bet:settled'
  | 'user:balance'
  | 'admin:state'
  | 'system:error'
  | 'system:connected'
  | 'system:disconnected';

export interface WebSocketEvent<T = unknown> {
  type: WebSocketEventType;
  payload: T;
  timestamp: string;
  sequence: number;
}

export interface GameMultiplierEvent {
  type: 'game:multiplier';
  sequence: number;
  roundId: string;
  multiplier: number;
  serverTime: string;
}

export interface GameRoundStartEvent {
  type: 'game:round-start';
  sequence: number;
  roundId: string;
  serverSeedHash: string;
  clientSeed: string;
  nonce: number;
  countdownSeconds: number;
  serverTime: string;
}

export interface GameRoundEndEvent {
  type: 'game:round-end';
  sequence: number;
  roundId: string;
  crashPoint: number;
  totalBets: number;
  totalWagered: number;
  totalPaidOut: number;
  serverTime: string;
}

export interface GameCountdownEvent {
  type: 'game:countdown';
  sequence: number;
  roundId: string;
  secondsRemaining: number;
  serverTime: string;
}

export interface GameStateEvent {
  type: 'game:state';
  sequence: number;
  state: GameState;
  serverTime: string;
}

export interface BetPlacedEvent {
  type: 'bet:placed';
  sequence: number;
  bet: Bet;
  serverTime: string;
}

export interface BetCashedOutEvent {
  type: 'bet:cashed-out';
  sequence: number;
  betId: string;
  multiplier: number;
  pnl: number;
  serverTime: string;
}

export interface UserBalanceEvent {
  type: 'user:balance';
  sequence: number;
  balance: number;
  currency: string;
  serverTime: string;
}

export interface SystemErrorEvent {
  type: 'system:error';
  sequence: number;
  code: string;
  message: string;
  serverTime: string;
}

export interface Plan {
  id: string;
  name: string;
  priceMonthly: number;
  priceYearly?: number;
  maxDailyEntries: number;
  fixedStake: number;
  fixedTarget: number;
  allowedModes: string[];
  features: string[];
  isPopular?: boolean;
}
