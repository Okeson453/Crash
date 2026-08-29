import { api } from './client';
import type { GameState, GameConfig, Round, FairnessData } from '@/types/api';

export async function getGameState(): Promise<GameState> {
  return api.get<GameState>('/api/v1/game/state');
}

export async function getGameConfig(): Promise<GameConfig> {
  return api.get<GameConfig>('/api/v1/game/config');
}

export async function getRecentRounds(limit = 20): Promise<Round[]> {
  return api.get<Round[]>(`/api/v1/rounds/recent?limit=${limit}`);
}

export async function getRoundById(roundId: string): Promise<Round> {
  return api.get<Round>(`/api/v1/rounds/${roundId}`);
}

export async function getRoundFairness(roundId: string): Promise<FairnessData> {
  return api.get<FairnessData>(`/api/v1/fairness/${roundId}`);
}
