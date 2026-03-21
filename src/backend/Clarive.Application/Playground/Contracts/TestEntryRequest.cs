using System.ComponentModel.DataAnnotations;

namespace Clarive.Application.Playground.Contracts;

public record TestEntryRequest(
    [property: StringLength(100)] string? Model = null,
    [property: Range(0.0, 2.0)] float Temperature = 1.0f,
    [property: Range(1, int.MaxValue)] int MaxTokens = 4096,
    Dictionary<string, string>? TemplateFields = null,
    [property: StringLength(20)] string? ReasoningEffort = null,
    bool? ShowReasoning = null,
    List<Guid>? McpServerIds = null,
    List<string>? ExcludedToolNames = null
);
