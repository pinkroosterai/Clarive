using Clarive.AI.Configuration;
using Clarive.Domain.Entities;
using Microsoft.Extensions.AI;

namespace Clarive.AI.Pipeline;

/// <summary>
/// Pure-function helpers for building and wrapping IChatClient options.
/// Extracted from OpenAIAgentFactory to reduce class size.
/// </summary>
public static class ChatOptionsBuilder
{
    public static IChatClient WrapWithModelDefaults(IChatClient client, AiProviderModel? model)
    {
        var defaults = BuildChatOptions(model);
        if (defaults is null)
            return client;

        return new ChatClientBuilder(client)
            .ConfigureOptions(options =>
            {
                options.Temperature ??= defaults.Temperature;
                options.MaxOutputTokens ??= defaults.MaxOutputTokens;
                options.Reasoning ??= defaults.Reasoning;
            })
            .Build();
    }

    public static IChatClient WrapWithRoleOverrides(
        IChatClient client,
        float? temperature,
        int? maxTokens,
        string? reasoningEffort
    )
    {
        if (temperature is null && maxTokens is null && string.IsNullOrWhiteSpace(reasoningEffort))
            return client;

        return new ChatClientBuilder(client)
            .ConfigureOptions(options =>
            {
                // Role overrides replace (not fallback) — they take priority over model defaults
                if (temperature.HasValue)
                    options.Temperature = temperature.Value;
                if (maxTokens.HasValue)
                    options.MaxOutputTokens = maxTokens.Value;
                if (!string.IsNullOrWhiteSpace(reasoningEffort))
                    options.Reasoning = new ReasoningOptions
                    {
                        Effort = ParseReasoningEffort(reasoningEffort),
                    };
            })
            .Build();
    }

    public static ChatOptions? BuildChatOptions(AiProviderModel? model)
    {
        if (model is null)
            return null;

        var hasTemp = !model.IsReasoning && model.DefaultTemperature.HasValue;
        var hasTokens = model.DefaultMaxTokens.HasValue;
        var hasReasoning =
            model.IsReasoning && !string.IsNullOrWhiteSpace(model.DefaultReasoningEffort);

        if (!hasTemp && !hasTokens && !hasReasoning)
            return null;

        var options = new ChatOptions();

        if (hasTemp)
            options.Temperature = model.DefaultTemperature!.Value;

        if (hasTokens)
            options.MaxOutputTokens = model.DefaultMaxTokens!.Value;

        if (hasReasoning)
        {
            options.Reasoning = new ReasoningOptions
            {
                Effort = ParseReasoningEffort(model.DefaultReasoningEffort!),
            };
        }

        return options;
    }

    public static ReasoningEffort ParseReasoningEffort(string effort) =>
        effort.ToLowerInvariant() switch
        {
            "low" => ReasoningEffort.Low,
            "high" => ReasoningEffort.High,
            "extra-high" or "extrahigh" => ReasoningEffort.ExtraHigh,
            _ => ReasoningEffort.Medium,
        };
}
