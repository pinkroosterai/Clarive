using Clarive.Domain.Interfaces.Repositories;
using Quartz;

namespace Clarive.Application.Background;

/// <summary>
/// Periodically fetches model metadata from the Clarive Model Registry service
/// via <see cref="IModelRegistryLookup"/> and auto-populates model fields.
/// Replaces <see cref="LiteLlmSyncJob"/> when ModelRegistry:Enabled is true.
/// </summary>
[DisallowConcurrentExecution]
public sealed class ModelRegistrySyncJob(
    IModelRegistryLookup registry,
    IAiProviderRepository providerRepo,
    ILogger<ModelRegistrySyncJob> logger
) : IJob
{
    public async Task Execute(IJobExecutionContext context)
    {
        ArgumentNullException.ThrowIfNull(context);
        var ct = context.CancellationToken;
        var providers = await providerRepo.GetAllAsync(ct);
        var updated = 0;

        foreach (var provider in providers)
        {
            foreach (var model in provider.Models)
            {
                var info = await registry.TryGetModelInfoAsync(provider.Name, model.ModelId, ct);
                if (info is null)
                    continue;

                var changed = false;

                if (info.IsReasoning is not null && model.IsReasoning != info.IsReasoning.Value)
                {
                    model.IsReasoning = info.IsReasoning.Value;
                    changed = true;
                }
                if (
                    info.SupportsFunctionCalling is not null
                    && model.SupportsFunctionCalling != info.SupportsFunctionCalling.Value
                )
                {
                    model.SupportsFunctionCalling = info.SupportsFunctionCalling.Value;
                    changed = true;
                }
                if (
                    info.SupportsResponseSchema is not null
                    && model.SupportsResponseSchema != info.SupportsResponseSchema.Value
                )
                {
                    model.SupportsResponseSchema = info.SupportsResponseSchema.Value;
                    changed = true;
                }

                if (!model.HasManualCostOverride && !provider.UseProviderPricing)
                {
                    if (
                        info.InputCostPerMillion is not null
                        && model.InputCostPerMillion != info.InputCostPerMillion
                    )
                    {
                        model.InputCostPerMillion = info.InputCostPerMillion;
                        changed = true;
                    }
                    if (
                        info.OutputCostPerMillion is not null
                        && model.OutputCostPerMillion != info.OutputCostPerMillion
                    )
                    {
                        model.OutputCostPerMillion = info.OutputCostPerMillion;
                        changed = true;
                    }
                    if (
                        info.MaxInputTokens is not null
                        && model.MaxInputTokens != info.MaxInputTokens
                    )
                    {
                        model.MaxInputTokens = info.MaxInputTokens;
                        changed = true;
                    }
                    if (
                        info.MaxOutputTokens is not null
                        && model.MaxOutputTokens != info.MaxOutputTokens
                    )
                    {
                        model.MaxOutputTokens = info.MaxOutputTokens;
                        changed = true;
                    }
                }

                if (changed)
                {
                    await providerRepo.UpdateModelAsync(model, ct);
                    updated++;
                }
            }
        }

        if (updated > 0)
            logger.LogInformation("Synced {Count} models from model registry", updated);
    }
}
