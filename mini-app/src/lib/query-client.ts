import { QueryClient } from '@tanstack/react-query';
import { AppError, RateLimitError } from '@/utils/errors';

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 30, // 30 seconds
      gcTime: 1000 * 60 * 5, // 5 minutes
      retry: (failureCount, error) => {
        // Don't retry on 401/403
        if (error instanceof Error) {
          const status = error instanceof AppError ? error.statusCode : undefined;
          if (status === 401 || status === 403) return false;
          if (error instanceof RateLimitError) return failureCount < 1;
        }
        return failureCount < 3;
      },
      refetchOnWindowFocus: false,
      refetchOnReconnect: true,
    },
    mutations: {
      retry: false,
    },
  },
});
