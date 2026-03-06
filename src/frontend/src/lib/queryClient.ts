import { QueryClient } from '@tanstack/react-query';

import { handleApiError } from '@/lib/handleApiError';
import { ApiError } from '@/services/api/apiClient';

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: (failureCount, error) => {
        if (error instanceof ApiError && error.status >= 400 && error.status < 500) return false;
        return failureCount < 2;
      },
    },
    mutations: {
      onError: (error) => {
        handleApiError(error, { fallback: 'Operation failed' });
      },
    },
  },
});
