import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation } from '@tanstack/react-query';
import { Camera, Trash2, Loader2, Eye, EyeOff, RotateCcw } from 'lucide-react';
import { useRef, useState } from 'react';
import { useForm } from 'react-hook-form';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';

import { HelpLink } from '@/components/common/HelpLink';
import { PasswordStrengthBar } from '@/components/common/PasswordStrengthBar';
import { UserAvatar } from '@/components/common/UserAvatar';
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
import { Separator } from '@/components/ui/separator';
import { validateAvatarFile } from '@/lib/avatarValidation';
import { handleApiError } from '@/lib/handleApiError';
import {
  updateProfileSchema,
  changePasswordSchema,
  type UpdateProfileFormData,
  type ChangePasswordFormData,
} from '@/lib/validationSchemas';
import { profileService } from '@/services';
import { useAuthStore } from '@/store/authStore';

export default function ProfileSection() {
  const currentUser = useAuthStore((s) => s.currentUser);
  const setUser = useAuthStore((s) => s.setUser);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);

  // Profile form
  const profileForm = useForm<UpdateProfileFormData>({
    resolver: zodResolver(updateProfileSchema),
    defaultValues: {
      name: currentUser?.name ?? '',
      email: currentUser?.email ?? '',
    },
  });

  // Password form
  const passwordForm = useForm<ChangePasswordFormData>({
    resolver: zodResolver(changePasswordSchema),
    defaultValues: { currentPassword: '', newPassword: '', confirmPassword: '' },
  });

  // Avatar upload mutation
  const avatarUpload = useMutation({
    mutationFn: (file: File) => profileService.uploadAvatar(file),
    onSuccess: () => {
      toast.success('Avatar updated');
      refreshUser();
    },
    onError: (err: unknown) => handleApiError(err, { fallback: 'Failed to upload avatar' }),
  });

  // Avatar delete mutation
  const avatarDelete = useMutation({
    mutationFn: () => profileService.deleteAvatar(),
    onSuccess: () => {
      toast.success('Avatar removed');
      refreshUser();
    },
    onError: (err: unknown) => handleApiError(err, { fallback: 'Failed to remove avatar' }),
  });

  // Profile update mutation
  const profileUpdate = useMutation({
    mutationFn: (data: profileService.UpdateProfileRequest) => profileService.updateProfile(data),
    onSuccess: (user) => {
      setUser(user);
      toast.success('Profile updated');
    },
    onError: (err: unknown) => handleApiError(err, { fallback: 'Failed to update profile' }),
  });

  // Password change mutation
  const passwordChange = useMutation({
    mutationFn: (data: profileService.UpdateProfileRequest) => profileService.updateProfile(data),
    onSuccess: (user) => {
      setUser(user);
      passwordForm.reset();
      toast.success('Password changed');
    },
    onError: (err: unknown) => handleApiError(err, { fallback: 'Failed to change password' }),
  });

  async function refreshUser() {
    try {
      const { getMe } = await import('@/services/api/profileService');
      const user = await getMe();
      setUser(user);
    } catch {
      // silently ignore
    }
  }

  function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    const validated = validateAvatarFile(file);
    if (!validated) return;

    avatarUpload.mutate(validated);
    e.target.value = '';
  }

  function onProfileSubmit(data: UpdateProfileFormData) {
    const changes: profileService.UpdateProfileRequest = {};
    if (data.name !== currentUser?.name) changes.name = data.name;
    if (data.email !== currentUser?.email) changes.email = data.email;

    if (Object.keys(changes).length === 0) {
      toast.info('No changes to save.');
      return;
    }

    profileUpdate.mutate(changes);
  }

  function onPasswordSubmit(data: ChangePasswordFormData) {
    passwordChange.mutate({
      currentPassword: data.currentPassword,
      newPassword: data.newPassword,
    });
  }

  const isGoogleUser = !currentUser?.hasPassword;
  const profileDirty = profileForm.formState.isDirty;
  const newPasswordValue = passwordForm.watch('newPassword');
  const avatarBusy = avatarUpload.isPending || avatarDelete.isPending;

  return (
    <div className="space-y-8 max-w-2xl">
      {/* Avatar Section */}
      <section className="space-y-4">
        <h2 className="text-lg font-semibold">Avatar</h2>
        <div className="flex items-center gap-4">
          <div className="relative group">
            <UserAvatar
              name={currentUser?.name || '?'}
              avatarUrl={currentUser?.avatarUrl}
              className="h-20 w-20"
              fallbackClassName="text-2xl"
            />
            {avatarBusy && (
              <div className="absolute inset-0 flex items-center justify-center bg-black/50 rounded-full">
                <Loader2 className="h-6 w-6 animate-spin text-white" />
              </div>
            )}
          </div>
          <div className="flex flex-col gap-2">
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                disabled={avatarBusy}
                onClick={() => fileInputRef.current?.click()}
              >
                <Camera className="mr-1.5 h-4 w-4" />
                Upload
              </Button>
              {currentUser?.avatarUrl && (
                <Button
                  variant="outline"
                  size="sm"
                  disabled={avatarBusy}
                  onClick={() => avatarDelete.mutate()}
                >
                  <Trash2 className="mr-1.5 h-4 w-4" />
                  Remove
                </Button>
              )}
            </div>
            <p className="text-xs text-foreground-muted">JPEG, PNG, or WebP. Max 3 MB.</p>
          </div>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            className="hidden"
            onChange={handleFileSelect}
          />
        </div>
      </section>

      <Separator />

      {/* Profile Details */}
      <section className="space-y-4">
        <div className="flex items-center gap-2">
          <h2 className="text-lg font-semibold">Profile</h2>
          <HelpLink section="account-settings" />
        </div>
        {isGoogleUser && (
          <p className="text-sm text-foreground-muted">
            Your name and email are managed by your Google account and cannot be changed here.
          </p>
        )}
        <Form {...profileForm}>
          <form onSubmit={profileForm.handleSubmit(onProfileSubmit)} className="space-y-4">
            <FormField
              control={profileForm.control}
              name="name"
              render={({ field }) => (
                <FormItem className="space-y-1.5">
                  <FormLabel>Name</FormLabel>
                  <FormControl>
                    <Input placeholder="Your name" disabled={isGoogleUser} {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={profileForm.control}
              name="email"
              render={({ field }) => (
                <FormItem className="space-y-1.5">
                  <FormLabel>Email</FormLabel>
                  <FormControl>
                    <Input
                      type="email"
                      placeholder="your@email.com"
                      disabled={isGoogleUser}
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            {!isGoogleUser && (
              <span title={!profileDirty ? 'No changes to save' : undefined}>
                <Button type="submit" disabled={!profileDirty || profileUpdate.isPending}>
                  {profileUpdate.isPending ? 'Saving...' : 'Save Changes'}
                </Button>
              </span>
            )}
          </form>
        </Form>
      </section>

      {currentUser?.hasPassword && (
        <>
          <Separator />

          {/* Change Password */}
          <section className="space-y-4">
            <h2 className="text-lg font-semibold">Change Password</h2>
            <Form {...passwordForm}>
              <form onSubmit={passwordForm.handleSubmit(onPasswordSubmit)} className="space-y-4">
                <FormField
                  control={passwordForm.control}
                  name="currentPassword"
                  render={({ field }) => (
                    <FormItem className="space-y-1.5">
                      <FormLabel>Current Password</FormLabel>
                      <FormControl>
                        <div className="relative">
                          <Input
                            type={showCurrentPassword ? 'text' : 'password'}
                            placeholder="Enter current password"
                            {...field}
                          />
                          <button
                            type="button"
                            className="absolute right-2 top-1/2 -translate-y-1/2 text-foreground-muted hover:text-foreground"
                            onClick={() => setShowCurrentPassword(!showCurrentPassword)}
                          >
                            {showCurrentPassword ? (
                              <EyeOff className="h-4 w-4" />
                            ) : (
                              <Eye className="h-4 w-4" />
                            )}
                          </button>
                        </div>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={passwordForm.control}
                  name="newPassword"
                  render={({ field }) => (
                    <FormItem className="space-y-1.5">
                      <FormLabel>New Password</FormLabel>
                      <FormControl>
                        <div className="relative">
                          <Input
                            type={showNewPassword ? 'text' : 'password'}
                            placeholder="At least 12 characters"
                            {...field}
                          />
                          <button
                            type="button"
                            className="absolute right-2 top-1/2 -translate-y-1/2 text-foreground-muted hover:text-foreground"
                            onClick={() => setShowNewPassword(!showNewPassword)}
                          >
                            {showNewPassword ? (
                              <EyeOff className="h-4 w-4" />
                            ) : (
                              <Eye className="h-4 w-4" />
                            )}
                          </button>
                        </div>
                      </FormControl>
                      <PasswordStrengthBar password={newPasswordValue} />
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={passwordForm.control}
                  name="confirmPassword"
                  render={({ field }) => (
                    <FormItem className="space-y-1.5">
                      <FormLabel>Confirm New Password</FormLabel>
                      <FormControl>
                        <Input type="password" placeholder="Repeat new password" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <Button type="submit" disabled={passwordChange.isPending}>
                  {passwordChange.isPending ? 'Changing...' : 'Change Password'}
                </Button>
              </form>
            </Form>
          </section>
        </>
      )}

      <Separator />

      {/* Onboarding */}
      <OnboardingSection />
    </div>
  );
}

function OnboardingSection() {
  const currentUser = useAuthStore((s) => s.currentUser);
  const setUser = useAuthStore((s) => s.setUser);
  const navigate = useNavigate();

  const resetTour = useMutation({
    mutationFn: () => import('@/services/api/profileService').then((m) => m.resetOnboarding()),
    onSuccess: () => {
      if (currentUser) {
        setUser({ ...currentUser, onboardingCompleted: false });
      }
      navigate('/');
    },
    onError: (err: unknown) => handleApiError(err, { fallback: 'Failed to reset onboarding' }),
  });

  return (
    <section className="space-y-4">
      <h2 className="text-lg font-semibold">Onboarding</h2>
      <p className="text-sm text-foreground-muted">
        Replay the guided tour to revisit key features of Clarive.
      </p>
      <Button variant="outline" onClick={() => resetTour.mutate()} disabled={resetTour.isPending}>
        <RotateCcw className="mr-1.5 h-4 w-4" />
        {resetTour.isPending ? 'Restarting...' : 'Restart onboarding tour'}
      </Button>
    </section>
  );
}
