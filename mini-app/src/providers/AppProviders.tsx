import type { ReactNode } from 'react';
import { TelegramProvider } from './TelegramProvider';
import { ThemeProvider } from './ThemeProvider';
import { QueryProvider } from './QueryProvider';
import { AuthProvider } from './AuthProvider';
import { WebSocketProvider } from './WebSocketProvider';
export function AppProviders({ children }: { children: ReactNode }) { return <TelegramProvider><ThemeProvider><QueryProvider><AuthProvider><WebSocketProvider>{children}</WebSocketProvider></AuthProvider></QueryProvider></ThemeProvider></TelegramProvider>; }
