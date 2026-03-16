import { zodResolver } from '@hookform/resolvers/zod';
import { Loader2, Eye, EyeOff, ShieldAlert, Info } from 'lucide-react';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { Navigate } from 'react-router-dom';
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
import { registerSchema, type RegisterFormData } from '@/lib/validationSchemas';
import { authService } from '@/services';
import { useAuthStore } from '@/store/authStore';

const SetupPage = () => {
  const { isAuthenticated, setUser, setWorkspaces } = useAuthStore();

  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  const form = useForm<RegisterFormData>({
    resolver: zodResolver(registerSchema),
    defaultValues: { name: '', email: '', password: '', confirmPassword: '' },
  });

  if (isAuthenticated) {
    return <Navigate to="/" replace />;
  }

  const onSubmit = async (data: RegisterFormData) => {
    try {
      const res = await authService.register(data.email, data.password, data.name);
      setUser(res.user);
      if (res.workspaces) setWorkspaces(res.workspaces);
      toast.success('Admin account created! Your instance is ready.');
      window.location.href = '/';
    } catch (err: unknown) {
      handleApiError(err, { fallback: 'Setup failed' });
    }
  };

  const passwordValue = form.watch('password');

  return (
    <div className="flex min-h-screen items-center justify-center auth-bg bg-background px-4">
      <div className="w-full max-w-sm animate-scale-in">
        <div className="bg-surface/80 backdrop-blur-xl border border-white/[0.08] rounded-2xl elevation-3 p-8">
          <div className="text-center space-y-2 mb-6">
            <AnvilIcon className="mx-auto mb-3 size-16" />
            <h1 className="text-2xl font-bold tracking-tight text-foreground">
              Set Up Your Instance
            </h1>
            <p className="text-foreground-muted text-sm">
              Create the super administrator account for your Clarive instance
            </p>
          </div>

          <div className="flex items-start gap-2.5 rounded-lg border border-primary/20 bg-primary/5 p-3 mb-5">
            <ShieldAlert className="size-4 text-primary mt-0.5 shrink-0" />
            <p className="text-xs text-foreground-muted leading-relaxed">
              This account will have full administrative access including system configuration,
              maintenance controls, and user management.
            </p>
          </div>

          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
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
                        placeholder="admin@example.com"
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
              <Button type="submit" className="w-full" disabled={form.formState.isSubmitting}>
                {form.formState.isSubmitting && <Loader2 className="animate-spin" />}
                Create Admin Account
              </Button>
            </form>
          </Form>
        </div>
        <div className="flex items-center justify-center gap-1.5 mt-4">
          <Info className="size-3 text-foreground-muted" />
          <p className="text-xs text-foreground-muted">
            Email verification is not required for the admin account.
          </p>
        </div>
      </div>
    </div>
  );
};

export default SetupPage;
