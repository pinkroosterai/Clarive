import { Loader2, XCircle } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { toast } from 'sonner';

import { AnvilIcon } from '@/components/icons/AnvilIcon';
import { Button } from '@/components/ui/button';
import { setRefreshToken, setToken } from '@/services/api/apiClient';
import { useAuthStore } from '@/store/authStore';

const ERROR_MESSAGES: Record<string, string> = {
  EMAIL_CONFLICT:
    'An account with this email already exists. Please log in with your password.',
  invalid_state: 'Authentication session expired. Please try again.',
  invalid_request: 'Invalid authentication request. Please try again.',
  not_configured: 'GitHub authentication is not configured.',
  GITHUB_AUTH_FAILED: 'GitHub authentication failed. Please try again.',
};

const GitHubCompletePage = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { initializeAuth } = useAuthStore();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    // Check for error from backend redirect (query param)
    const errorCode = searchParams.get('error');
    if (errorCode) {
      setError(ERROR_MESSAGES[errorCode] ?? 'GitHub sign-in failed. Please try again.');
      return;
    }

    // Extract tokens from URL fragment (set by backend redirect)
    const hash = window.location.hash.substring(1);
    const params = new URLSearchParams(hash);
    const token = params.get('token');
    const refresh = params.get('refresh');
    const isNewUser = params.get('isNewUser') === 'true';

    if (!token || !refresh) {
      setError('No authentication tokens received. Please try again.');
      return;
    }

    // Clear the hash from the URL (tokens are sensitive)
    window.history.replaceState(null, '', window.location.pathname);

    // Set tokens and initialize auth
    setToken(token);
    setRefreshToken(refresh);

    (async () => {
      try {
        await initializeAuth();
        if (cancelled) return;

        if (isNewUser) {
          toast.success('Welcome to Clarive!');
        }

        const { workspaces } = useAuthStore.getState();
        if (workspaces.length > 1) {
          navigate('/select-workspace', { replace: true });
        } else {
          navigate('/', { replace: true });
        }
      } catch {
        if (!cancelled) {
          setError('Failed to complete sign-in. Please try again.');
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [navigate, searchParams, initializeAuth]);

  if (error) {
    return (
      <div className="flex min-h-screen items-center justify-center auth-bg bg-background px-4">
        <div className="w-full max-w-sm animate-scale-in">
          <div className="bg-surface/80 backdrop-blur-xl border border-white/[0.08] rounded-2xl elevation-3 p-8">
            <div className="text-center space-y-2 mb-6">
              <AnvilIcon className="mx-auto mb-3 size-16" />
              <h1 className="text-2xl font-bold tracking-tight text-foreground">Sign-in failed</h1>
            </div>
            <div className="space-y-4 text-center">
              <XCircle className="mx-auto size-12 text-error-text" />
              <p className="text-foreground-muted text-sm">{error}</p>
              <Button className="w-full" onClick={() => navigate('/login', { replace: true })}>
                Back to sign in
              </Button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center auth-bg bg-background px-4">
      <div className="w-full max-w-sm animate-scale-in">
        <div className="bg-surface/80 backdrop-blur-xl border border-white/[0.08] rounded-2xl elevation-3 p-8 text-center space-y-4">
          <AnvilIcon className="mx-auto size-16" />
          <Loader2 className="mx-auto size-8 animate-spin text-primary" />
          <p className="text-foreground-muted text-sm">Completing GitHub sign-in...</p>
        </div>
      </div>
    </div>
  );
};

export default GitHubCompletePage;
