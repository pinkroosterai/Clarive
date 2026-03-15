using System.ComponentModel.DataAnnotations;

namespace Clarive.Api.Models.Requests;

public record CreateAiProviderRequest(
    [property: Required, StringLength(100)]
    string Name,
    [property: StringLength(500)]
    string? EndpointUrl,
    [property: Required]
    string ApiKey
);

public record UpdateAiProviderRequest(
    [property: StringLength(100)]
    string? Name = null,
    [property: StringLength(500)]
    string? EndpointUrl = null,
    string? ApiKey = null,
    bool? IsActive = null,
    int? SortOrder = null
);

public record AddAiProviderModelRequest(
    [property: Required, StringLength(100)]
    string ModelId,
    [property: StringLength(100)]
    string? DisplayName = null,
    bool IsReasoning = false,
    int MaxContextSize = 128000,
    bool IsTemperatureConfigurable = true
);

public record UpdateAiProviderModelRequest(
    [property: StringLength(100)]
    string? DisplayName = null,
    bool? IsReasoning = null,
    int? MaxContextSize = null,
    bool? IsTemperatureConfigurable = null,
    bool? IsActive = null,
    int? SortOrder = null
);
