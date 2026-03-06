import { Loader2, XCircle } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';

import { AnvilIcon } from '@/components/icons/AnvilIcon';
import { Button } from '@/components/ui/button';
import { authService } from '@/services';
import { useAuthStore } from '@/store/authStore';

const GoogleCallbackPage = () => {
  const navigate = useNavigate();
  const { setUser, setWorkspaces } = useAuthStore();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      // Extract id_token from the URL hash fragment (OIDC implicit flow)
      const hash = window.location.hash.substring(1);
      const params = new URLSearchParams(hash);
      const idToken = params.get('id_token');
      const hashError = params.get('error');

      if (hashError) {
        if (!cancelled) setError(params.get('error_description') ?? 'Authentication was denied.');
        return;
      }

      if (!idToken) {
        if (!cancelled) setError('No authentication token received from Google.');
        return;
      }

      try {
        const res = await authService.googleAuth(idToken);
        if (cancelled) return;
        setUser(res.user);
        if (res.workspaces) setWorkspaces(res.workspaces);
        if (res.isNewUser) {
          toast.success('Welcome to Clarive!');
        }
        if (res.workspaces && res.workspaces.length > 1) {
          navigate('/select-workspace', { replace: true });
        } else {
          navigate('/', { replace: true });
        }
      } catch (err: unknown) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Google sign-in failed.');
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [navigate, setUser, setWorkspaces]);

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
              <p className="text-foreground-secondary text-sm">{error}</p>
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
          <p className="text-foreground-muted text-sm">Completing Google sign-in...</p>
        </div>
      </div>
    </div>
  );
};

export default GoogleCallbackPage;
