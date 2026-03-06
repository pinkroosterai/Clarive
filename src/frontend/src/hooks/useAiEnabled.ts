import { useAuthStore } from '@/store/authStore';

export function useAiEnabled(): boolean {
  return useAuthStore((s) => s.aiConfigured);
}
