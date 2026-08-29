import { create } from 'zustand';
import type { GameState, GameConfig, Bet, BalanceResponse } from '@/types/api';
import type { GamePhase, RoundHistoryItem, LiveFeedItem } from '@/types/game';

const GAME_PHASES: GamePhase[] = ['idle','waiting','countdown','running','crashed','cashed_out','paused','error'];
function toGamePhase(value: GameState['phase']): GamePhase { return GAME_PHASES.find((phase) => phase === value) ?? 'error'; }

interface GameStateStore {
  // Game state
  phase: GamePhase;
  roundId: string | null;
  multiplier: number | null;
  countdownSeconds: number | null;
  crashPoint: number | null;
  serverTime: string | null;

  // Config
  config: GameConfig | null;

  // Current bet
  activeBet: Bet | null;
  activeBets: [Bet | null, Bet | null];

  // Balance
  balance: number | null;
  currency: string;
  currencySymbol: string;

  // History
  roundHistory: RoundHistoryItem[];
  liveFeed: LiveFeedItem[];

  // UI state
  isPlacingBet: boolean;
  isCashingOut: boolean;
  betError: string | null;
  cashoutError: string | null;

  // Actions
  setGameState: (state: GameState) => void;
  setGameConfig: (config: GameConfig) => void;
  setMultiplier: (multiplier: number) => void;
  setCountdown: (seconds: number) => void;
  setPhase: (phase: GamePhase) => void;
  setActiveBet: (bet: Bet | null) => void;
  setIndexedActiveBet: (index: 0 | 1, bet: Bet | null) => void;
  setBalance: (balance: BalanceResponse) => void;
  updateBalance: (balance: number) => void;
  addRoundHistory: (round: RoundHistoryItem) => void;
  addLiveFeedItem: (item: LiveFeedItem) => void;
  setIsPlacingBet: (value: boolean) => void;
  setIsCashingOut: (value: boolean) => void;
  setBetError: (error: string | null) => void;
  setCashoutError: (error: string | null) => void;
  clearErrors: () => void;
  resetForNewRound: () => void;
}

export const useGameStore = create<GameStateStore>((set) => ({
  phase: 'idle',
  roundId: null,
  multiplier: null,
  countdownSeconds: null,
  crashPoint: null,
  serverTime: null,
  config: null,
  activeBet: null,
  activeBets: [null, null],
  balance: null,
  currency: 'USD',
  currencySymbol: '$',
  roundHistory: [],
  liveFeed: [],
  isPlacingBet: false,
  isCashingOut: false,
  betError: null,
  cashoutError: null,

  setGameState: (state) =>
    set({
      phase: toGamePhase(state.phase),
      roundId: state.roundId,
      multiplier: state.multiplier,
      countdownSeconds: state.countdownSeconds,
      crashPoint: state.crashPoint,
      serverTime: state.serverTime,
    }),

  setGameConfig: (config) => set({ config }),

  setMultiplier: (multiplier) => set({ multiplier }),

  setCountdown: (countdownSeconds) => set({ countdownSeconds }),

  setPhase: (phase) => set({ phase }),

  setActiveBet: (activeBet) => set({ activeBet, activeBets: [activeBet, null] }),
  setIndexedActiveBet: (index, bet) => set((state) => { const next: [Bet | null, Bet | null] = [...state.activeBets]; next[index] = bet; return { activeBets: next, activeBet: index === 0 ? bet : state.activeBet }; }),

  setBalance: (balance) =>
    set({
      balance: balance.balance,
      currency: balance.currency,
      currencySymbol: balance.currencySymbol,
    }),

  updateBalance: (balance) => set({ balance }),

  addRoundHistory: (round) =>
    set((state) => ({
      roundHistory: [round, ...state.roundHistory].slice(0, 50),
    })),

  addLiveFeedItem: (item) =>
    set((state) => ({
      liveFeed: [item, ...state.liveFeed].slice(0, 100),
    })),

  setIsPlacingBet: (value) => set({ isPlacingBet: value }),

  setIsCashingOut: (value) => set({ isCashingOut: value }),

  setBetError: (error) => set({ betError: error }),

  setCashoutError: (error) => set({ cashoutError: error }),

  clearErrors: () => set({ betError: null, cashoutError: null }),

  resetForNewRound: () =>
    set({
      activeBet: null,
      activeBets: [null, null],
      multiplier: null,
      crashPoint: null,
      betError: null,
      cashoutError: null,
    }),
}));
