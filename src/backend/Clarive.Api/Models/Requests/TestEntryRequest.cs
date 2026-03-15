using System.ComponentModel.DataAnnotations;

namespace Clarive.Api.Models.Requests;

public record TestEntryRequest(
    [property: StringLength(100)]
    string? Model = null,
    [property: Range(0.0, 2.0)]
    float Temperature = 1.0f,
    [property: Range(1, 32000)]
    int MaxTokens = 4096,
    Dictionary<string, string>? TemplateFields = null
);
