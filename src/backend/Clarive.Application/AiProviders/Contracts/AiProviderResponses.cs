namespace Clarive.Application.AiProviders.Contracts;

public record AiProviderResponse(
    Guid Id,
    string Name,
    string? EndpointUrl,
    bool IsActive,
    string ApiMode,
    Dictionary<string, string>? CustomHeaders,
    bool UseProviderPricing,
    int SortOrder,
    bool IsKeyConfigured,
    List<AiProviderModelResponse> Models,
    DateTime CreatedAt,
    DateTime UpdatedAt
);

public record AiProviderModelResponse(
    Guid Id,
    string ModelId,
    string? DisplayName,
    bool IsReasoning,
    bool SupportsFunctionCalling,
    bool SupportsResponseSchema,
    long? MaxInputTokens,
    long? MaxOutputTokens,
    float? DefaultTemperature,
    int? DefaultMaxTokens,
    string? DefaultReasoningEffort,
    decimal? InputCostPerMillion,
    decimal? OutputCostPerMillion,
    bool HasManualCostOverride,
    bool IsActive,
    int SortOrder
);

public record FetchedModelItem(
    string ModelId,
    bool IsReasoning,
    bool SupportsFunctionCalling,
    bool SupportsResponseSchema,
    long? MaxInputTokens,
    long? MaxOutputTokens,
    decimal? InputCostPerMillion,
    decimal? OutputCostPerMillion
);

public record FetchedModelsResponse(List<FetchedModelItem> Models);

public record EnrichedModelResponse(
    string ModelId,
    string? DisplayName,
    Guid ProviderId,
    string ProviderName,
    bool IsReasoning,
    bool SupportsFunctionCalling,
    bool SupportsResponseSchema,
    long? MaxInputTokens,
    long? MaxOutputTokens,
    float? DefaultTemperature,
    int? DefaultMaxTokens,
    string? DefaultReasoningEffort
);

public record EnrichedModelsListResponse(List<EnrichedModelResponse> Models);
