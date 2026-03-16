import { zodResolver } from '@hookform/resolvers/zod';
import { Loader2, Eye, EyeOff } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { Link, Navigate, useNavigate } from 'react-router-dom';

import { GoogleLoginButton } from '@/components/auth/GoogleLoginButton';
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
import { config } from '@/lib/config';
import { handleApiError } from '@/lib/handleApiError';
import { loginSchema, type LoginFormData } from '@/lib/validationSchemas';
import { authService } from '@/services';
import { getActiveWorkspaceId } from '@/services/api/apiClient';
import { getSetupStatus } from '@/services/api/authService';
import { useAuthStore } from '@/store/authStore';

const LoginPage = () => {
  const navigate = useNavigate();
  const { isAuthenticated, setUser, setWorkspaces, switchWorkspace } = useAuthStore();

  const [showPassword, setShowPassword] = useState(false);
  const [allowRegistration, setAllowRegistration] = useState(true);
  const [emailEnabled, setEmailEnabled] = useState(true);

  useEffect(() => {
    getSetupStatus()
      .then((s) => {
        setAllowRegistration(s.allowRegistration);
        setEmailEnabled(s.emailEnabled);
      })
      .catch(() => {
        // Non-critical — registration/email flags default to safe values
      });
  }, []);

  const form = useForm<LoginFormData>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: '', password: '' },
  });

  if (isAuthenticated) {
    return <Navigate to="/" replace />;
  }

  const onSubmit = async (data: LoginFormData) => {
    try {
      const res = await authService.login(data.email, data.password);
      setUser(res.user);
      if (res.workspaces) setWorkspaces(res.workspaces);

      if (res.workspaces && res.workspaces.length > 1) {
        const rememberedId = getActiveWorkspaceId();
        const rememberPref = localStorage.getItem('cl_remember_workspace');
        if (
          rememberedId &&
          rememberPref === 'true' &&
          res.workspaces.some((w) => w.id === rememberedId)
        ) {
          try {
            await switchWorkspace(rememberedId);
            navigate('/');
          } catch {
            navigate('/select-workspace');
          }
        } else {
          navigate('/select-workspace');
        }
      } else {
        navigate('/');
      }
    } catch (err: unknown) {
      handleApiError(err, { fallback: 'Login failed' });
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center auth-bg bg-background px-4">
      <div className="w-full max-w-sm animate-scale-in">
        <div className="bg-surface/80 backdrop-blur-xl border border-white/[0.08] rounded-2xl elevation-3 p-8">
          <div className="text-center space-y-2 mb-6">
            <AnvilIcon className="mx-auto mb-3 size-16" />
            <h1 className="text-2xl font-bold tracking-tight text-foreground">Clarive</h1>
            <p className="text-foreground-muted text-sm">Sign in to manage your prompts</p>
          </div>

          {config.googleClientId && (
            <div className="space-y-4">
              <GoogleLoginButton />

              <div className="relative">
                <div className="absolute inset-0 flex items-center">
                  <span className="w-full border-t border-border" />
                </div>
                <div className="relative flex justify-center text-xs uppercase">
                  <span className="bg-surface/80 px-2 text-foreground-muted">or</span>
                </div>
              </div>
            </div>
          )}

          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="mt-4 space-y-4">
              <FormField
                control={form.control}
                name="email"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Email</FormLabel>
                    <FormControl>
                      <Input
                        type="email"
                        placeholder="you@example.com"
                        autoComplete="email"
                        className="bg-elevated border-border focus:ring-2 focus:ring-primary/30 transition-shadow"
                        {...field}
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
                    <div className="flex items-center justify-between">
                      <FormLabel>Password</FormLabel>
                      {emailEnabled && (
                        <Link
                          to="/forgot-password"
                          className="text-xs text-primary hover:text-primary/80 underline-offset-4 hover:underline"
                        >
                          Forgot password?
                        </Link>
                      )}
                    </div>
                    <FormControl>
                      <div className="relative">
                        <Input
                          type={showPassword ? 'text' : 'password'}
                          placeholder="••••••••"
                          autoComplete="current-password"
                          className="pr-10 bg-elevated border-border focus:ring-2 focus:ring-primary/30 transition-shadow"
                          {...field}
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
              <Button type="submit" className="w-full" disabled={form.formState.isSubmitting}>
                {form.formState.isSubmitting && <Loader2 className="animate-spin" />}
                Sign in
              </Button>
            </form>
          </Form>
        </div>
        {allowRegistration && (
          <p className="mt-4 text-center text-sm text-foreground-muted">
            Don&apos;t have an account?{' '}
            <Link
              to="/register"
              className="text-primary hover:text-primary/80 underline-offset-4 hover:underline"
            >
              Register
            </Link>
          </p>
        )}
        <p className="mt-3 text-center text-xs text-foreground-muted">
          <Link
            to="/terms"
            className="hover:text-foreground underline-offset-4 hover:underline"
          >
            Terms
          </Link>
          <span className="mx-1.5">&middot;</span>
          <Link
            to="/privacy"
            className="hover:text-foreground underline-offset-4 hover:underline"
          >
            Privacy
          </Link>
        </p>
      </div>
    </div>
  );
};

export default LoginPage;
