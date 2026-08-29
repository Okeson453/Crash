import type { ReactNode } from 'react';

interface SafeAreaProps {
  children: ReactNode;
}

export function SafeArea({ children }: SafeAreaProps) {
  return (
    <div
      className="safe-area flex flex-col min-h-screen"
    >
      {children}
    </div>
  );
}
