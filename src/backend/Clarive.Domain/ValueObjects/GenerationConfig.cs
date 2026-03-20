namespace Clarive.Domain.ValueObjects;

/// <summary>
/// Serializable configuration for a generation session.
/// Persisted in AiSession.Config (jsonb) for use across generate/refine calls.
/// </summary>
public record GenerationConfig
{
    public required string Description { get; init; }
    public bool GenerateSystemMessage { get; init; }
    public bool GenerateAsPromptTemplate { get; init; }
    public bool GenerateAsPromptChain { get; init; }
    public List<ToolInfo> SelectedTools { get; init; } = [];
    public bool EnableWebSearch { get; init; }
}

public record ToolInfo(string Name, string Description);
