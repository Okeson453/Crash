import { create } from 'zustand';

export type ToastType = 'success' | 'error' | 'warning' | 'info';

export interface Toast {
  id: string;
  type: ToastType;
  message: string;
  duration?: number;
}

export interface Notification { id: string; type: 'bet' | 'win' | 'loss' | 'cashout' | 'engine' | 'connection' | 'auth' | 'risk' | 'system'; title: string; body: string; link?: string; createdAt: string; read: boolean; }

export type BottomSheetType = 'bet_filters' | 'game_rules' | 'fairness_info' | null;

interface UIState {
  // Theme
  theme: 'light' | 'dark';

  // Navigation
  activeTab: string;
  previousTab: string | null;

  // Toasts
  toasts: Toast[];
  notifications: Notification[];
  unreadCount: number;

  // Bottom sheet
  bottomSheet: BottomSheetType;
  bottomSheetData: unknown;

  // Loading states
  globalLoading: boolean;
  loadingMessage: string | null;

  // Offline
  isOffline: boolean;

  // Onboarding
  showOnboarding: boolean;

  // Actions
  setTheme: (theme: 'light' | 'dark') => void;
  setActiveTab: (tab: string) => void;
  addToast: (toast: Omit<Toast, 'id'>) => void;
  removeToast: (id: string) => void;
  addNotification: (notification: Omit<Notification, 'read'>) => void;
  markRead: (id: string) => void;
  markAllRead: () => void;
  clearNotifications: () => void;
  showBottomSheet: (type: BottomSheetType, data?: unknown) => void;
  hideBottomSheet: () => void;
  setGlobalLoading: (loading: boolean, message?: string) => void;
  setIsOffline: (offline: boolean) => void;
  setShowOnboarding: (show: boolean) => void;
}

let toastIdCounter = 0;

export const useUIStore = create<UIState>((set) => ({
  theme: 'light',
  activeTab: 'game',
  previousTab: null,
  toasts: [],
  notifications: [],
  unreadCount: 0,
  bottomSheet: null,
  bottomSheetData: null,
  globalLoading: false,
  loadingMessage: null,
  isOffline: false,
  showOnboarding: false,

  setTheme: (theme) => set({ theme }),

  setActiveTab: (tab) =>
    set((state) => ({
      previousTab: state.activeTab,
      activeTab: tab,
    })),

  addToast: (toast) =>
    set((state) => {
      const id = `toast-${++toastIdCounter}`;
      const newToast = { ...toast, id };
      // Auto-remove after duration
      const duration = toast.duration ?? 4000;
      setTimeout(() => {
        set((s) => ({
          toasts: s.toasts.filter((t) => t.id !== id),
        }));
      }, duration);
      return { toasts: [...state.toasts, newToast] };
    }),

  addNotification: (notification) => set((state) => { const next = [{ ...notification, read: false }, ...state.notifications].slice(0, 50); return { notifications: next, unreadCount: next.filter((item) => !item.read).length }; }),

  markRead: (id) => set((state) => { const next = state.notifications.map((item) => item.id === id ? { ...item, read: true } : item); return { notifications: next, unreadCount: next.filter((item) => !item.read).length }; }),

  markAllRead: () => set((state) => ({ notifications: state.notifications.map((item) => ({ ...item, read: true })), unreadCount: 0 })),

  clearNotifications: () => set({ notifications: [], unreadCount: 0 }),

  removeToast: (id) =>
    set((state) => ({
      toasts: state.toasts.filter((t) => t.id !== id),
    })),

  showBottomSheet: (type, data) => set({ bottomSheet: type, bottomSheetData: data }),

  hideBottomSheet: () => set({ bottomSheet: null, bottomSheetData: null }),

  setGlobalLoading: (loading, message) =>
    set({ globalLoading: loading, loadingMessage: message ?? null }),

  setIsOffline: (offline) => set({ isOffline: offline }),

  setShowOnboarding: (show) => set({ showOnboarding: show }),
}));
