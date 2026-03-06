import { toast } from 'sonner';

import { ApiError } from '@/services/api/apiClient';

export interface HandleApiErrorOptions {
  /** Override the toast title */
  title?: string;
  /** Fallback message when error is not an ApiError */
  fallback?: string;
  /** Do not show a toast */
  silent?: boolean;
}

/**
 * Centralized API error handler.
 *
 * - 4xx expected errors: shows the backend message as a toast
 * - 5xx server errors: shows "Server error" with the error message
 * - Unknown errors: shows generic fallback toast
 */
export function handleApiError(err: unknown, options: HandleApiErrorOptions = {}): void {
  const { title, fallback = 'An unexpected error occurred.', silent = false } = options;

  if (err instanceof ApiError) {
    if (!silent) {
      if (err.status >= 500) {
        toast.error(title ?? 'Server error', {
          description: err.message,
          duration: 8000,
        });
      } else if (err.status === 429) {
        toast.error('Too many requests', {
          description: 'Please wait a moment and try again.',
        });
      } else {
        toast.error(title ?? err.message);
      }
    }
  } else if (err instanceof TypeError && err.message === 'Failed to fetch') {
    if (!silent) {
      toast.error('Network error', {
        description: 'Check your connection and try again.',
      });
    }
  } else if (err instanceof Error) {
    if (!silent) toast.error(title ?? (err.message || fallback));
  } else {
    if (!silent) toast.error(title ?? fallback);
  }
}
