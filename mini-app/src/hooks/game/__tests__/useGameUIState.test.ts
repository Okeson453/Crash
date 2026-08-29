import { describe, expect, it } from 'vitest';
import { useGameStore } from '@/stores/gameStore';
describe('game UI state model', () => { it('supports explicit failure state data', () => { useGameStore.getState().setBetError('late bet'); expect(useGameStore.getState().betError).toBe('late bet'); useGameStore.getState().clearErrors(); expect(useGameStore.getState().betError).toBeNull(); }); });
