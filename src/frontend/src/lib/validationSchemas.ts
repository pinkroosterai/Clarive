import { z } from 'zod';

const MIN_PASSWORD_LENGTH = 12;

const email = z.string().min(1, 'Email is required').email('Invalid email address');

const password = z
  .string()
  .min(1, 'Password is required')
  .min(MIN_PASSWORD_LENGTH, `Password must be at least ${MIN_PASSWORD_LENGTH} characters`);

const name = z.string().min(1, 'Name is required');

export const loginSchema = z.object({
  email,
  password: z.string().min(1, 'Password is required'),
});

export const registerSchema = z
  .object({
    name,
    email,
    password,
    confirmPassword: z.string().min(1, 'Please confirm your password'),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: 'Passwords do not match',
    path: ['confirmPassword'],
  });

export const forgotPasswordSchema = z.object({
  email,
});

export const resetPasswordSchema = z
  .object({
    password,
    confirmPassword: z.string().min(1, 'Please confirm your password'),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: 'Passwords do not match',
    path: ['confirmPassword'],
  });

export const updateProfileSchema = z.object({
  name,
  email,
});

export const changePasswordSchema = z
  .object({
    currentPassword: z.string().min(1, 'Current password is required'),
    newPassword: password,
    confirmPassword: z.string().min(1, 'Please confirm your new password'),
  })
  .refine((data) => data.newPassword === data.confirmPassword, {
    message: 'Passwords do not match',
    path: ['confirmPassword'],
  });

export type LoginFormData = z.infer<typeof loginSchema>;
export type RegisterFormData = z.infer<typeof registerSchema>;
export type ForgotPasswordFormData = z.infer<typeof forgotPasswordSchema>;
export type ResetPasswordFormData = z.infer<typeof resetPasswordSchema>;
export type UpdateProfileFormData = z.infer<typeof updateProfileSchema>;
export type ChangePasswordFormData = z.infer<typeof changePasswordSchema>;

// --- Non-RHF schemas (used for inline validation) ---

export const inviteUserSchema = z.object({
  email: z.string().min(1, 'Email is required').email('Invalid email address'),
  role: z.enum(['editor', 'viewer']),
});

export const apiKeyNameSchema = z
  .string()
  .min(1, 'Name is required')
  .max(100, 'Name must be 100 characters or fewer');

export const workspaceNameSchema = z
  .string()
  .min(1, 'Name is required')
  .max(255, 'Name must be 255 characters or fewer');

export type InviteUserFormData = z.infer<typeof inviteUserSchema>;
export type ApiKeyNameFormData = z.infer<typeof apiKeyNameSchema>;
export type WorkspaceNameFormData = z.infer<typeof workspaceNameSchema>;
