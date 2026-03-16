import { zodResolver } from '@hookform/resolvers/zod';
import { Loader2, Eye, EyeOff, CheckCircle2, XCircle } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { useSearchParams, useNavigate, Navigate } from 'react-router-dom';
import { toast } from 'sonner';

import { AnvilIcon } from '@/components/icons/AnvilIcon';
import { Button } from '@/components/ui/button';
import {
  Form,
  FormField,
  FormItem,
  FormLabel,
  FormControl,
  FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { handleApiError } from '@/lib/handleApiError';
import {
  acceptInvitationSchema,
  type AcceptInvitationFormData,
} from '@/lib/validationSchemas';
import { invitationService } from '@/services';
import type { InvitationInfo } from '@/services/api/invitationService';
import { useAuthStore } from '@/store/authStore';

type PageState = 'validating' | 'form' | 'expired' | 'submitting' | 'success';

const AcceptInvitationPage = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const token = searchParams.get('token') ?? '';
  const { isAuthenticated, setUser, setWorkspaces } = useAuthStore();

  const [state, setState] = useState<PageState>(token ? 'validating' : 'expired');
  const [info, setInfo] = useState<InvitationInfo | null>(null);
  const [errorMessage, setErrorMessage] = useState('Invalid or missing invitation link.');

  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  const form = useForm<AcceptInvitationFormData>({
    resolver: zodResolver(acceptInvitationSchema),
    defaultValues: { name: '', password: '', confirmPassword: '' },
  });

  // Validate token on mount
  useEffect(() => {
    if (!token || isAuthenticated) return;

    let cancelled = false;
    (async () => {
      try {
        const result = await invitationService.validateToken(token);
        if (!cancelled) {
          setInfo(result);
          setState('form');
        }
      } catch {
        if (!cancelled) {
          setState('expired');
          setErrorMessage('This invitation link is invalid or has expired.');
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [token, isAuthenticated]);

  // If already authenticated, redirect
  if (isAuthenticated) {
    return <Navigate to="/" replace />;
  }

  const onSubmit = async (data: AcceptInvitationFormData) => {
    setState('submitting');
    try {
      const res = await invitationService.acceptInvitation(token, data.name, data.password);
      setUser(res.user);
      if (res.workspaces) setWorkspaces(res.workspaces);
      setState('success');
      toast.success('Welcome to the team!');
      setTimeout(() => navigate('/', { replace: true }), 1500);
    } catch (err: unknown) {
      handleApiError(err, { fallback: 'Failed to accept invitation' });
      setState('form');
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center auth-bg bg-background px-4">
      <div className="w-full max-w-sm animate-scale-in">
        <div className="bg-surface/80 backdrop-blur-xl border border-white/[0.08] rounded-2xl elevation-3 p-8">
          <div className="text-center space-y-2 mb-6">
            <AnvilIcon className="mx-auto mb-3 size-16" />
            <h1 className="text-2xl font-bold tracking-tight text-foreground">
              {state === 'success' ? "You're in!" : 'Join your team'}
            </h1>
            {info && state !== 'success' && (
              <p className="text-foreground-muted text-sm">
                You've been invited to{' '}
                <span className="font-medium text-foreground-muted">{info.workspaceName}</span>{' '}
                as {info.role === 'editor' ? 'an' : 'a'} {info.role}
              </p>
            )}
          </div>

          <div className="space-y-4">
            {state === 'validating' && (
              <div className="text-center space-y-4">
                <Loader2 className="mx-auto size-8 animate-spin text-primary" />
                <p className="text-foreground-muted text-sm">Validating invitation...</p>
              </div>
            )}

            {state === 'expired' && (
              <div className="text-center space-y-4">
                <XCircle className="mx-auto size-12 text-error-text" />
                <p className="text-foreground-muted text-sm">{errorMessage}</p>
                <p className="text-foreground-muted text-xs">
                  Contact your workspace admin for a new invitation.
                </p>
              </div>
            )}

            {state === 'success' && (
              <div className="text-center space-y-4">
                <CheckCircle2 className="mx-auto size-12 text-success-text" />
                <p className="text-foreground-muted text-sm">
                  Your account has been created. Redirecting...
                </p>
              </div>
            )}

            {(state === 'form' || state === 'submitting') && (
              <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="invite-email">Email</Label>
                    <Input
                      id="invite-email"
                      type="email"
                      value={info?.email ?? ''}
                      disabled
                      className="bg-elevated border-border opacity-60"
                    />
                  </div>
                  <FormField
                    control={form.control}
                    name="name"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Name</FormLabel>
                        <FormControl>
                          <Input
                            {...field}
                            placeholder="Your name"
                            autoComplete="name"
                            autoFocus
                            className="bg-elevated border-border focus:ring-2 focus:ring-primary/30 transition-shadow"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="password"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Password</FormLabel>
                        <FormControl>
                          <div className="relative">
                            <Input
                              {...field}
                              type={showPassword ? 'text' : 'password'}
                              placeholder="••••••••"
                              autoComplete="new-password"
                              className="pr-10 bg-elevated border-border focus:ring-2 focus:ring-primary/30 transition-shadow"
                            />
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              className="absolute right-1 top-1/2 -translate-y-1/2 h-7 w-7"
                              onClick={() => setShowPassword(!showPassword)}
                              tabIndex={-1}
                              aria-label={showPassword ? 'Hide password' : 'Show password'}
                            >
                              {showPassword ? (
                                <EyeOff className="size-4" />
                              ) : (
                                <Eye className="size-4" />
                              )}
                            </Button>
                          </div>
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="confirmPassword"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Confirm password</FormLabel>
                        <FormControl>
                          <div className="relative">
                            <Input
                              {...field}
                              type={showConfirm ? 'text' : 'password'}
                              placeholder="••••••••"
                              autoComplete="new-password"
                              className="pr-10 bg-elevated border-border focus:ring-2 focus:ring-primary/30 transition-shadow"
                            />
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              className="absolute right-1 top-1/2 -translate-y-1/2 h-7 w-7"
                              onClick={() => setShowConfirm(!showConfirm)}
                              tabIndex={-1}
                              aria-label={
                                showConfirm ? 'Hide confirm password' : 'Show confirm password'
                              }
                            >
                              {showConfirm ? (
                                <EyeOff className="size-4" />
                              ) : (
                                <Eye className="size-4" />
                              )}
                            </Button>
                          </div>
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <Button
                    type="submit"
                    className="w-full"
                    disabled={state === 'submitting' || form.formState.isSubmitting}
                  >
                    {(state === 'submitting' || form.formState.isSubmitting) && (
                      <Loader2 className="animate-spin" />
                    )}
                    Create account & join
                  </Button>
                </form>
              </Form>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default AcceptInvitationPage;
