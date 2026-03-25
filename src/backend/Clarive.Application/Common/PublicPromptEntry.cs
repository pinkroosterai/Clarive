using Clarive.Domain.Entities;

namespace Clarive.Application.Common;

public record PublicPromptEntry(
    Guid Id,
    string Title,
    string? SystemMessage,
    int Version,
    List<PublicPrompt> Prompts,
    List<string> Tags,
    DateTime UpdatedAt,
    DateTime? PublishedAt,
    List<PublicTabSummary> Tabs,
    int TabCount
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
    DateTime UpdatedAt,
    List<PublicTabSummary> Tabs,
    int TabCount
);

public record PublicTabSummary(
    Guid Id,
    string Name,
    bool IsMainTab,
    int? ForkedFromVersion
);
