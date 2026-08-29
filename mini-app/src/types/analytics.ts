/**
 * Analytics-specific type definitions
 */

export interface KPICard {
  label: string;
  value: string | number;
  change: number;
  changeLabel: string;
  trend: 'up' | 'down' | 'neutral';
}

export interface PlayerAnalytics {
  id: string;
  username: string;
  totalBets: number;
  totalWagered: number;
  totalPnl: number;
  winRate: number;
  lastActive: string;
}

export interface TimeSeriesPoint {
  timestamp: string;
  value: number;
}

export interface DistributionBin {
  label: string;
  count: number;
  percentage: number;
}
