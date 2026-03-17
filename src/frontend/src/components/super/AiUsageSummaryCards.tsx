import { Activity, Hash, TrendingUp, Cpu, DollarSign } from 'lucide-react';

import { HeroStatCard } from './HeroStatCard';

import type { AiUsageStatsResponse } from '@/services/api/aiUsageService';

interface AiUsageSummaryCardsProps {
  stats: AiUsageStatsResponse;
}

export default function AiUsageSummaryCards({ stats }: AiUsageSummaryCardsProps) {
  const topModel = stats.byModel[0];
  const hasCostData = stats.totals.totalEstimatedCostUsd > 0;

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
      <HeroStatCard
        icon={Activity}
        label="Total Tokens"
        value={stats.totals.totalTokens}
        index={0}
      />
      <HeroStatCard
        icon={Hash}
        label="Total Requests"
        value={stats.totals.totalRequests}
        index={1}
      />
      <HeroStatCard
        icon={TrendingUp}
        label="Avg Tokens / Request"
        value={Math.round(stats.averages.avgTotalTokensPerRequest)}
        index={2}
      />
      <HeroStatCard
        icon={Cpu}
        label={topModel ? `Top: ${topModel.name}` : 'Top Model'}
        value={topModel ? topModel.totalTokens : 0}
        index={3}
      />
      <HeroStatCard
        icon={DollarSign}
        label="Est. Cost"
        value={hasCostData ? stats.totals.totalEstimatedCostUsd : 0}
        prefix={hasCostData ? '$' : undefined}
        decimals={hasCostData ? 2 : undefined}
        index={4}
      />
    </div>
  );
}
