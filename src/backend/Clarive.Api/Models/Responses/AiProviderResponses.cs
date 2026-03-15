namespace Clarive.Api.Models.Responses;

public record AiProviderResponse(
    Guid Id,
    string Name,
    string? EndpointUrl,
    bool IsActive,
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
    int MaxContextSize,
    bool IsTemperatureConfigurable,
    bool IsActive,
    int SortOrder
);

public record FetchedModelsResponse(List<string> Models);
