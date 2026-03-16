using Clarive.Api.Models.Entities;
using Clarive.Api.Models.Enums;
using Clarive.Api.Repositories.Interfaces;
using Clarive.Api.Services.Interfaces;

namespace Clarive.Api.Services;

public class AiUsageLogger(
    IAiUsageLogRepository repo,
    IAiProviderRepository providerRepo,
    ILogger<AiUsageLogger> logger) : IAiUsageLogger
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
        CancellationToken ct = default)
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
                CreatedAt = DateTime.UtcNow
            };

            // Look up cost rates from provider model config
            var costRates = await LookupCostRatesAsync(model, provider, ct);
            if (costRates is not null)
            {
                if (costRates.Value.InputCostPerMillion is not null)
                    log.EstimatedInputCostUsd = inputTokens / 1_000_000m * costRates.Value.InputCostPerMillion.Value;
                if (costRates.Value.OutputCostPerMillion is not null)
                    log.EstimatedOutputCostUsd = outputTokens / 1_000_000m * costRates.Value.OutputCostPerMillion.Value;
            }

            await repo.AddAsync(log, ct);
        }
        catch (Exception ex)
        {
            logger.LogWarning(ex, "Failed to log AI usage for {ActionType} on model {Model}", actionType, model);
        }
    }

    private async Task<(decimal? InputCostPerMillion, decimal? OutputCostPerMillion)?> LookupCostRatesAsync(
        string model, string provider, CancellationToken ct)
    {
        try
        {
            return await providerRepo.GetModelCostAsync(provider, model, ct);
        }
        catch
        {
            return null; // Don't fail logging if cost lookup fails
        }
    }
}
