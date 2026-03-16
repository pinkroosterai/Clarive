interface AppConfig {
  apiUrl: string;
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
  mode: import.meta.env.MODE,
};

// Fetch Google Client ID from API (DB-backed config)
let cachedGoogleClientId: string | null = null;
export async function getGoogleClientId(): Promise<string> {
  if (cachedGoogleClientId !== null) return cachedGoogleClientId;
  try {
    const res = await fetch('/api/auth/google-client-id');
    if (!res.ok) throw new Error('Failed to fetch Google Client ID');
    const data = await res.json();
    cachedGoogleClientId = data.clientId ?? '';
  } catch {
    cachedGoogleClientId = '';
  }
  return cachedGoogleClientId;
}
