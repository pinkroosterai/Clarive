interface AppConfig {
  apiUrl: string;
  googleClientId: string;
  mode: string;
}

// Runtime config injected by docker-entrypoint.sh (Docker deployments).
// Falls back to Vite build-time env vars for local development.
const rc = (window as unknown as Record<string, unknown>).__CLARIVE_CONFIG__ as
  | Record<string, unknown>
  | undefined;

export const APP_VERSION = '0.1.1';

export const config: AppConfig = {
  apiUrl: (rc?.apiUrl as string) || import.meta.env.VITE_API_URL || '',
  googleClientId: (rc?.googleClientId as string) || import.meta.env.VITE_GOOGLE_CLIENT_ID || '',
  mode: import.meta.env.MODE,
};
