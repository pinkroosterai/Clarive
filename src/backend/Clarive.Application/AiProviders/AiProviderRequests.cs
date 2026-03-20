using System.ComponentModel.DataAnnotations;

namespace Clarive.Application.AiProviders;

public record CreateAiProviderRequest(
    [property: Required, StringLength(100)] string Name,
    [property: StringLength(500)] string? EndpointUrl,
    [property: Required] string ApiKey,
    string? ApiMode = null
);

public record UpdateAiProviderRequest(
    [property: StringLength(100)] string? Name = null,
    [property: StringLength(500)] string? EndpointUrl = null,
    string? ApiKey = null,
    bool? IsActive = null,
    int? SortOrder = null,
    string? ApiMode = null
);

public record AddAiProviderModelRequest(
    [property: Required, StringLength(100)] string ModelId,
    [property: StringLength(100)] string? DisplayName = null,
    bool IsReasoning = false,
    bool SupportsFunctionCalling = false,
    bool SupportsResponseSchema = false,
    long? MaxInputTokens = null,
    long? MaxOutputTokens = null,
    [property: Range(0.0, 2.0)] float? DefaultTemperature = null,
    [property: Range(1, int.MaxValue)] int? DefaultMaxTokens = null,
    [property: StringLength(20)] string? DefaultReasoningEffort = null,
    [property: Range(0, 1000)] decimal? InputCostPerMillion = null,
    [property: Range(0, 1000)] decimal? OutputCostPerMillion = null
);

public record UpdateAiProviderModelRequest(
    [property: StringLength(100)] string? DisplayName = null,
    bool? IsReasoning = null,
    bool? SupportsFunctionCalling = null,
    bool? SupportsResponseSchema = null,
    long? MaxInputTokens = null,
    long? MaxOutputTokens = null,
    bool? IsActive = null,
    int? SortOrder = null,
    [property: Range(0.0, 2.0)] float? DefaultTemperature = null,
    [property: Range(1, int.MaxValue)] int? DefaultMaxTokens = null,
    [property: StringLength(20)] string? DefaultReasoningEffort = null,
    [property: Range(0, 1000)] decimal? InputCostPerMillion = null,
    [property: Range(0, 1000)] decimal? OutputCostPerMillion = null,
    bool? HasManualCostOverride = null
);
