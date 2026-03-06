import * as Sentry from "@sentry/react";
import { config } from "@/lib/config";

export function initSentry(): void {
  if (!config.sentryDsn) return;

  Sentry.init({
    dsn: config.sentryDsn,
    release: config.sentryRelease || undefined,
    environment: config.mode,
    integrations: [Sentry.browserTracingIntegration()],
    tracesSampleRate: isNaN(config.sentryTracesSampleRate) ? 0 : config.sentryTracesSampleRate,

    beforeBreadcrumb(breadcrumb) {
      if (breadcrumb.data?.url) {
        breadcrumb.data.url = scrubPii(breadcrumb.data.url);
      }
      return breadcrumb;
    },

    beforeSend(event) {
      // Drop 401 SESSION_EXPIRED — expected browser flow, not a bug
      const isSessionExpired = event.exception?.values?.some((v) =>
        v.value?.includes("SESSION_EXPIRED"),
      );
      if (isSessionExpired) return null;

      return event;
    },
  });
}

function scrubPii(value: string): string {
  return value.replace(/[^\s@]+@[^\s@]+\.[^\s@]+/g, "[email]");
}

export function setSentryUser(user: {
  id: string;
  email: string;
  role: string;
}): void {
  if (!config.sentryDsn) return;
  Sentry.setUser({ id: user.id, email: user.email });
  Sentry.setTag("user.role", user.role);
}

export function clearSentryUser(): void {
  if (!config.sentryDsn) return;
  Sentry.setUser(null);
}

export { Sentry };
