import { zodResolver } from '@hookform/resolvers/zod';
import { Loader2, Eye, EyeOff } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { useForm } from 'react-hook-form';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import { toast } from 'sonner';

import { GitHubLoginButton } from '@/components/auth/GitHubLoginButton';
import { GoogleLoginButton } from '@/components/auth/GoogleLoginButton';
import { getGitHubClientId, getGoogleClientId } from '@/lib/config';
import { PasswordStrengthBar } from '@/components/common/PasswordStrengthBar';
import { AnvilIcon } from '@/components/icons/AnvilIcon';
import { Button } from '@/components/ui/button';
import {
  Form,
  FormField,
  FormItem,
  FormLabel,
  FormControl,
  FormDescription,
  FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { handleApiError } from '@/lib/handleApiError';
import { registerSchema, type RegisterFormData } from '@/lib/validationSchemas';
import { authService } from '@/services';
import { useAuthStore } from '@/store/authStore';

const RegisterPage = () => {
  const navigate = useNavigate();
  const { isAuthenticated, setUser, setWorkspaces } = useAuthStore();

  useEffect(() => {
    document.title = 'Clarive — Register';
  }, []);

  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [hasOAuthProvider, setHasOAuthProvider] = useState(false);

  useEffect(() => {
    Promise.all([getGoogleClientId(), getGitHubClientId()]).then(([google, github]) => {
      setHasOAuthProvider(!!google || !!github);
    });
  }, []);
  const [honeypot, setHoneypot] = useState('');
  const formLoadedAt = useRef(Date.now());

  const form = useForm<RegisterFormData>({
    resolver: zodResolver(registerSchema),
    defaultValues: { name: '', email: '', password: '', confirmPassword: '' },
  });

  if (isAuthenticated) {
    return <Navigate to="/" replace />;
  }

  const onSubmit = async (data: RegisterFormData) => {
    try {
      const res = await authService.register(data.email, data.password, data.name, honeypot, formLoadedAt.current);
      setUser(res.user);
      if (res.workspaces) setWorkspaces(res.workspaces);
      toast.success('Account created! Check your email to verify your address.');
      setTimeout(() => navigate('/'), 150);
    } catch (err: unknown) {
      handleApiError(err, { fallback: 'Registration failed' });
    }
  };

  const passwordValue = form.watch('password');

  return (
    <div className="flex min-h-screen items-center justify-center auth-bg bg-background px-4">
      <div className="w-full max-w-sm animate-scale-in">
        <div className="bg-surface/80 backdrop-blur-xl border border-white/[0.08] rounded-2xl elevation-3 p-8">
          <div className="text-center space-y-2 mb-6">
            <AnvilIcon className="mx-auto mb-3 size-16" />
            <h1 className="text-2xl font-bold tracking-tight text-foreground">Clarive</h1>
            <p className="text-foreground-muted text-sm">Create your account to get started</p>
          </div>

          <div className="space-y-4">
            <GoogleLoginButton />
            <GitHubLoginButton />

            {hasOAuthProvider && (
              <div className="relative">
                <div className="absolute inset-0 flex items-center">
                  <span className="w-full border-t border-border" />
                </div>
                <div className="relative flex justify-center text-xs uppercase">
                  <span className="bg-surface/80 px-2 text-foreground-muted">or</span>
                </div>
              </div>
            )}
          </div>

          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="mt-4 space-y-4">
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Name</FormLabel>
                    <FormControl>
                      <Input
                        placeholder="Your name"
                        autoComplete="name"
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
                    <FormLabel>Password</FormLabel>
                    <FormDescription>Must be at least 12 characters</FormDescription>
                    <FormControl>
                      <div className="relative">
                        <Input
                          type={showPassword ? 'text' : 'password'}
                          placeholder="••••••••"
                          autoComplete="new-password"
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
                    <PasswordStrengthBar password={passwordValue} />
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
                          type={showConfirm ? 'text' : 'password'}
                          placeholder="••••••••"
                          autoComplete="new-password"
                          className="pr-10 bg-elevated border-border focus:ring-2 focus:ring-primary/30 transition-shadow"
                          {...field}
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
                          {showConfirm ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                        </Button>
                      </div>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              {/* Anti-spam honeypot — hidden from humans, filled by bots */}
              <input
                type="text"
                name="website"
                value={honeypot}
                onChange={(e) => setHoneypot(e.target.value)}
                autoComplete="off"
                tabIndex={-1}
                aria-hidden="true"
                style={{ position: 'absolute', left: '-9999px', opacity: 0, height: 0, width: 0 }}
              />
              <p className="text-xs text-foreground-muted text-center">
                By creating an account, you agree to our{' '}
                <Link
                  to="/terms"
                  className="text-primary hover:text-primary/80 underline-offset-4 hover:underline"
                >
                  Terms of Service
                </Link>{' '}
                and{' '}
                <Link
                  to="/privacy"
                  className="text-primary hover:text-primary/80 underline-offset-4 hover:underline"
                >
                  Privacy Policy
                </Link>
                .
              </p>
              <Button type="submit" className="w-full" disabled={form.formState.isSubmitting}>
                {form.formState.isSubmitting && <Loader2 className="animate-spin" />}
                Create account
              </Button>
            </form>
          </Form>
        </div>
        <p className="mt-4 text-center text-sm text-foreground-muted">
          Already have an account?{' '}
          <Link
            to="/login"
            className="text-primary hover:text-primary/80 underline-offset-4 hover:underline"
          >
            Sign in
          </Link>
        </p>
      </div>
    </div>
  );
};

export default RegisterPage;
