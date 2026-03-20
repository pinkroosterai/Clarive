using Clarive.Infrastructure.Cache;
using Clarive.Domain.Entities;
using Clarive.Domain.Enums;
using Clarive.Domain.Interfaces.Repositories;
using Clarive.Domain.Interfaces.Services;

namespace Clarive.Application.AiProviders.Services;

public class AiUsageLogger(
    IAiUsageLogRepository repo,
    IAiProviderRepository providerRepo,
    TenantCacheService cache,
    ILogger<AiUsageLogger> logger
) : IAiUsageLogger
{
    public async Task LogAsync(
        Guid tenantId,
        Guid userId,
        AiActionType actionType,
        string model,
        string provider,
        long inputTokens,
        long outputTokens,
        long durationMs,
        Guid? entryId = null,
        CancellationToken ct = default
    )
    {
        try
        {
            var log = new AiUsageLog
            {
                Id = Guid.NewGuid(),
                TenantId = tenantId,
                UserId = userId,
                ActionType = actionType,
                Model = model,
                Provider = provider,
                InputTokens = inputTokens,
                OutputTokens = outputTokens,
                DurationMs = durationMs,
                EntryId = entryId,
                CreatedAt = DateTime.UtcNow,
            };

            // Look up cost rates from provider model config (cached 1 hour)
            var costRates = await LookupCostRatesAsync(model, provider, ct);
            if (costRates is not null)
            {
                if (costRates.InputCostPerMillion is not null)
                    log.EstimatedInputCostUsd =
                        inputTokens / 1_000_000m * costRates.InputCostPerMillion.Value;
                if (costRates.OutputCostPerMillion is not null)
                    log.EstimatedOutputCostUsd =
                        outputTokens / 1_000_000m * costRates.OutputCostPerMillion.Value;
            }

            await repo.AddAsync(log, ct);
        }
        catch (Exception ex)
        {
            logger.LogWarning(
                ex,
                "Failed to log AI usage for {ActionType} on model {Model}",
                actionType,
                model
            );
        }
    }

    private async Task<ModelCostRates?> LookupCostRatesAsync(
        string model,
        string provider,
        CancellationToken ct
    )
    {
        var cacheKey = TenantCacheKeys.FormatModelCostKey(provider, model);
        try
        {
            return await cache.GetOrCreateGlobalAsync(
                cacheKey,
                async _ =>
                {
                    var cost = await providerRepo.GetModelCostAsync(provider, model, ct);
                    return cost is null
                        ? null
                        : new ModelCostRates(
                            cost.Value.InputCostPerMillion,
                            cost.Value.OutputCostPerMillion
                        );
                },
                TenantCacheKeys.ModelCostTtl,
                ct
            );
        }
        catch (Exception ex)
        {
            logger.LogWarning(ex, "Failed to resolve model cost rates for usage logging");
            return null;
        }
    }

    private record ModelCostRates(decimal? InputCostPerMillion, decimal? OutputCostPerMillion);
}
