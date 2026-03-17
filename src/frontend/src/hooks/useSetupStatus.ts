import { useQuery } from '@tanstack/react-query';

import { getSetupStatus } from '@/services/api/configService';

export function useSetupStatus() {
  return useQuery({
    queryKey: ['setup-status'],
    queryFn: getSetupStatus,
    staleTime: 60_000,
  });
}
