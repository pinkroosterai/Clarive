import { Loader2, CheckCircle2, XCircle } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';

import { AnvilIcon } from '@/components/icons/AnvilIcon';
import { Button } from '@/components/ui/button';
import { authService } from '@/services';

type VerifyState = 'loading' | 'success' | 'error';

const VerifyEmailPage = () => {
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token') ?? '';
  useEffect(() => {
    document.title = 'Clarive — Verify Email';
  }, []);

  const [state, setState] = useState<VerifyState>(token ? 'loading' : 'error');
  const [errorMessage, setErrorMessage] = useState('Invalid or missing verification token.');

  useEffect(() => {
    if (!token) return;

    let cancelled = false;
    (async () => {
      try {
        await authService.verifyEmail(token);
        if (!cancelled) setState('success');
      } catch (err: unknown) {
        if (!cancelled) {
          setState('error');
          const GENERIC_ERRORS = ['Not Found', 'Bad Request', 'Internal Server Error', 'UNKNOWN'];
          const msg = err instanceof Error ? err.message : '';
          setErrorMessage(
            msg && !GENERIC_ERRORS.includes(msg)
              ? msg
              : 'Verification failed. The link may be invalid or expired.'
          );
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [token]);

  return (
    <div className="flex min-h-screen items-center justify-center auth-bg bg-background px-4">
      <div className="w-full max-w-sm animate-scale-in">
        <div className="bg-surface/80 backdrop-blur-xl border border-white/[0.08] rounded-2xl elevation-3 p-8">
          <div className="text-center space-y-2 mb-6">
            <AnvilIcon className="mx-auto mb-3 size-16" />
            <h1 className="text-2xl font-bold tracking-tight text-foreground">
              Email verification
            </h1>
          </div>

          <div className="space-y-4 text-center">
            {state === 'loading' && (
              <>
                <Loader2 className="mx-auto size-8 animate-spin text-primary" />
                <p className="text-foreground-muted text-sm">Verifying your email address...</p>
              </>
            )}

            {state === 'success' && (
              <>
                <CheckCircle2 className="mx-auto size-12 text-success-text" />
                <p className="text-foreground-muted text-sm">
                  Your email has been verified successfully.
                </p>
                <Link to="/login">
                  <Button className="w-full">Continue to sign in</Button>
                </Link>
              </>
            )}

            {state === 'error' && (
              <>
                <XCircle className="mx-auto size-12 text-error-text" />
                <p className="text-foreground-muted text-sm">{errorMessage}</p>
                <Link to="/login">
                  <Button variant="outline" className="w-full">
                    Back to sign in
                  </Button>
                </Link>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default VerifyEmailPage;
