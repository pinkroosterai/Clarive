import { toast } from 'sonner';

const ALLOWED_AVATAR_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
const MAX_AVATAR_SIZE = 3 * 1024 * 1024; // 3 MB

/**
 * Validates an avatar file for type and size.
 * Shows a toast on validation failure.
 * Returns the file if valid, or null if invalid.
 */
export function validateAvatarFile(file: File): File | null {
  if (!ALLOWED_AVATAR_TYPES.includes(file.type)) {
    toast.error('Unsupported format. Use JPEG, PNG, or WebP.');
    return null;
  }
  if (file.size > MAX_AVATAR_SIZE) {
    toast.error('Image exceeds the 3 MB size limit.');
    return null;
  }
  return file;
}
