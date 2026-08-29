/**
 * User-specific type definitions
 */

export type UserRole = 'player' | 'operator' | 'admin';
export type UserStatus = 'onboarding' | 'active' | 'suspended' | 'cancelled' | 'banned';
export type ThemePreference = 'system' | 'light' | 'dark';

export interface PlayerProfile {
  id: string;
  telegramId: string;
  username: string | null;
  firstName: string;
  lastName: string | null;
  photoUrl: string | null;
  email: string | null;
  status: UserStatus;
  role: UserRole;
  planName: string | null;
  timezone: string;
  joinedAt: string;
}

export interface OnboardingStep {
  id: string;
  title: string;
  description: string;
  completed: boolean;
}

export interface OnboardingState {
  isComplete: boolean;
  currentStep: number;
  steps: OnboardingStep[];
}
