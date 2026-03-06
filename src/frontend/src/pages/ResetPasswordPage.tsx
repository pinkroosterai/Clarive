import { zodResolver } from '@hookform/resolvers/zod';
import { Loader2, Eye, EyeOff } from 'lucide-react';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { Link, useSearchParams, useNavigate } from 'react-router-dom';
import { toast } from 'sonner';

import { PasswordStrengthBar } from '@/components/common/PasswordStrengthBar';
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
import { handleApiError } from '@/lib/handleApiError';
import { resetPasswordSchema, type ResetPasswordFormData } from '@/lib/validationSchemas';
import { authService } from '@/services';

const ResetPasswordPage = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token') ?? '';

  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  const form = useForm<ResetPasswordFormData>({
    resolver: zodResolver(resetPasswordSchema),
    defaultValues: { password: '', confirmPassword: '' },
  });

  if (!token) {
    return (
      <div className="flex min-h-screen items-center justify-center auth-bg bg-background px-4">
        <div className="w-full max-w-sm animate-scale-in">
          <div className="bg-surface/80 backdrop-blur-xl border border-white/[0.08] rounded-2xl elevation-3 p-8 text-center space-y-4">
            <h1 className="text-2xl font-bold tracking-tight text-foreground">Invalid link</h1>
            <p className="text-foreground-muted text-sm">
              This password reset link is invalid or has expired.
            </p>
            <Link to="/forgot-password">
              <Button variant="outline" className="w-full">
                Request a new link
              </Button>
            </Link>
          </div>
        </div>
      </div>
    );
  }

  const onSubmit = async (data: ResetPasswordFormData) => {
    try {
      await authService.resetPassword(token, data.password);
      toast.success('Password reset successfully. Please sign in.');
      navigate('/login');
    } catch (err: unknown) {
      handleApiError(err, { fallback: 'Failed to reset password' });
    }
  };

  const passwordValue = form.watch('password');

  return (
    <div className="flex min-h-screen items-center justify-center auth-bg bg-background px-4">
      <div className="w-full max-w-sm animate-scale-in">
        <div className="bg-surface/80 backdrop-blur-xl border border-white/[0.08] rounded-2xl elevation-3 p-8">
          <div className="text-center space-y-2 mb-6">
            <AnvilIcon className="mx-auto mb-3 size-16" />
            <h1 className="text-2xl font-bold tracking-tight text-foreground">Set new password</h1>
            <p className="text-foreground-muted text-sm">
              Choose a strong password for your account
            </p>
          </div>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <FormField
                control={form.control}
                name="password"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>New password</FormLabel>
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
                        >
                          {showConfirm ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                        </Button>
                      </div>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <Button type="submit" className="w-full" disabled={form.formState.isSubmitting}>
                {form.formState.isSubmitting && <Loader2 className="animate-spin" />}
                Reset password
              </Button>
            </form>
          </Form>
        </div>
        <p className="mt-4 text-center text-sm text-foreground-muted">
          Remember your password?{' '}
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

export default ResetPasswordPage;
