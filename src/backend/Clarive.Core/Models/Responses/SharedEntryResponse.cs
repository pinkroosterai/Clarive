using Clarive.Domain.Entities;

namespace Clarive.Core.Models.Responses;

public record ShareLinkResult(string RawToken, ShareLink Link);

public record SharedEntryResult(
    Guid EntryId,
    string Title,
    string? SystemMessage,
    int Version,
    DateTime? PublishedAt,
    List<SharedPrompt> Prompts,
    bool PasswordRequired
);

public record SharedPrompt(
    string Content,
    int Order,
    bool IsTemplate,
    List<TemplateField>? TemplateFields
);
