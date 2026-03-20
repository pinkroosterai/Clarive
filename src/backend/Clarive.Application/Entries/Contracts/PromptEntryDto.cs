using Clarive.Domain.Entities;
using Clarive.Domain.Enums;

namespace Clarive.Application.Entries.Contracts;

public record PromptEntryDto(
    Guid Id,
    string Title,
    int Version,
    string VersionState,
    bool IsTrashed,
    Guid? FolderId,
    bool HasSystemMessage,
    bool IsTemplate,
    bool IsChain,
    int PromptCount,
    string? FirstPromptPreview,
    DateTime CreatedAt,
    DateTime UpdatedAt,
    List<string> Tags,
    bool IsFavorited
)
{
    public static PromptEntryDto FromEntryAndVersion(
        PromptEntry entry,
        PromptEntryVersion? version,
        List<string>? tags = null,
        bool isFavorited = false
    )
    {
        var preview = version?.Prompts.OrderBy(p => p.Order).FirstOrDefault()?.Content;
        if (preview is not null && preview.Length > 100)
            preview = preview[..100] + "...";

        return new PromptEntryDto(
            entry.Id,
            entry.Title,
            version?.Version ?? 0,
            (version?.VersionState ?? Clarive.Domain.Enums.VersionState.Draft).ToString().ToLower(),
            entry.IsTrashed,
            entry.FolderId,
            HasSystemMessage: !string.IsNullOrEmpty(version?.SystemMessage),
            IsTemplate: version?.Prompts.Any(p => p.IsTemplate) ?? false,
            IsChain: (version?.Prompts.Count ?? 0) > 1,
            PromptCount: version?.Prompts.Count ?? 0,
            FirstPromptPreview: preview,
            entry.CreatedAt,
            entry.UpdatedAt,
            Tags: tags ?? [],
            IsFavorited: isFavorited
        );
    }
}
