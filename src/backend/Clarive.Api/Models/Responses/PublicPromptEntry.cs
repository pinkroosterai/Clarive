using Clarive.Api.Models.Entities;

namespace Clarive.Api.Models.Responses;

public record PublicPromptEntry(
    Guid Id,
    string Title,
    string? SystemMessage,
    int Version,
    List<PublicPrompt> Prompts
);

public record PublicPrompt(
    string Content,
    int Order,
    bool IsTemplate,
    List<TemplateField>? TemplateFields
);
