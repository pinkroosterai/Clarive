import { toast } from "sonner";
import * as Sentry from "@sentry/react";
import { ApiError } from "@/services/api/apiClient";

const EXPECTED_CODES = new Set([
  "VALIDATION_ERROR",
  "NOT_FOUND",
  "ALREADY_EXISTS",
  "FORBIDDEN",
"EMAIL_NOT_VERIFIED",
  "INVALID_CREDENTIALS",
  "SESSION_EXPIRED",
  "CONCURRENCY_CONFLICT",
  "RATE_LIMITED",
]);

export interface HandleApiErrorOptions {
  /** Override the toast title */
  title?: string;
  /** Fallback message when error is not an ApiError */
  fallback?: string;
  /** Do not show a toast (just capture to Sentry) */
  silent?: boolean;
}

/**
 * Centralized API error handler.
 *
 * - 4xx expected errors: shows the backend message as a toast, no Sentry capture
 * - 5xx server errors: captures to Sentry, shows "Server error (Ref: ...)" if sentryId available
 * - Unknown errors: captures to Sentry, shows generic fallback toast
 */
export function handleApiError(
  err: unknown,
  options: HandleApiErrorOptions = {},
): void {
  const {
    title,
    fallback = "An unexpected error occurred.",
    silent = false,
  } = options;

  if (err instanceof ApiError) {
    const isExpected =
      EXPECTED_CODES.has(err.code) ||
      (err.status >= 400 && err.status < 500);

    if (!isExpected) {
      Sentry.captureException(err, {
        extra: { statusCode: err.status, errorCode: err.code },
      });
    }

    if (!silent) {
      if (err.status >= 500 && err.sentryId) {
        toast.error(title ?? "Server error", {
          description: `${err.message} (Ref: ${err.sentryId.slice(0, 8)})`,
          duration: 8000,
        });
      } else if (err.status === 429) {
        toast.error("Too many requests", {
          description: "Please wait a moment and try again.",
        });
      } else {
        toast.error(title ?? err.message);
      }
    }
  } else if (err instanceof TypeError && err.message === "Failed to fetch") {
    Sentry.captureException(err);
    if (!silent) {
      toast.error("Network error", {
        description: "Check your connection and try again.",
      });
    }
  } else if (err instanceof Error) {
    Sentry.captureException(err);
    if (!silent) toast.error(title ?? (err.message || fallback));
  } else {
    Sentry.captureMessage(`Unknown error: ${String(err)}`, "error");
    if (!silent) toast.error(title ?? fallback);
  }
}
