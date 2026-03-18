using Clarive.Api.Models.Entities;

namespace Clarive.Api.Models.Responses;

public record PublicPromptEntry(
    Guid Id,
    string Title,
    string? SystemMessage,
    int Version,
    List<PublicPrompt> Prompts,
    List<string> Tags,
    DateTime UpdatedAt,
    DateTime? PublishedAt
);

public record PublicPrompt(
    string Content,
    int Order,
    bool IsTemplate,
    List<TemplateField>? TemplateFields
);

public record PublicEntrySummary(
    Guid Id,
    string Title,
    int Version,
    bool HasSystemMessage,
    bool IsTemplate,
    bool IsChain,
    int PromptCount,
    string? FirstPromptPreview,
    List<string> Tags,
    DateTime CreatedAt,
    DateTime UpdatedAt
);
