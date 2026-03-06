interface AppConfig {
  apiUrl: string;
  googleClientId: string;
  sentryDsn: string;
  sentryTracesSampleRate: number;
  sentryRelease: string;
  mode: string;
}

// Runtime config injected by docker-entrypoint.sh (Docker deployments).
// Falls back to Vite build-time env vars for local development.
const rc = (window as Record<string, unknown>).__CLARIVE_CONFIG__ as
  | Record<string, unknown>
  | undefined;

export const config: AppConfig = {
  apiUrl: (rc?.apiUrl as string) || import.meta.env.VITE_API_URL || "",
  googleClientId:
    (rc?.googleClientId as string) ||
    import.meta.env.VITE_GOOGLE_CLIENT_ID ||
    "",
  sentryDsn:
    (rc?.sentryDsn as string) || import.meta.env.VITE_SENTRY_DSN || "",
  sentryTracesSampleRate:
    (rc?.sentryTracesSampleRate as number) ??
    parseFloat(import.meta.env.VITE_SENTRY_TRACES_SAMPLE_RATE || "0"),
  sentryRelease:
    (rc?.sentryRelease as string) ||
    import.meta.env.VITE_SENTRY_RELEASE ||
    "",
  mode: import.meta.env.MODE,
};
