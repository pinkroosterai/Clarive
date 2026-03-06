using Clarive.Api.Models.Entities;
using Clarive.Api.Models.Enums;

namespace Clarive.Api.Models.Responses;

public record PromptEntrySummary(
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
    DateTime UpdatedAt
)
{
    public static PromptEntrySummary FromEntryAndVersion(PromptEntry entry, PromptEntryVersion? version)
    {
        var preview = version?.Prompts.OrderBy(p => p.Order).FirstOrDefault()?.Content;
        if (preview is not null && preview.Length > 100)
            preview = preview[..100] + "...";

        return new PromptEntrySummary(
            entry.Id,
            entry.Title,
            version?.Version ?? 0,
            (version?.VersionState ?? Enums.VersionState.Draft).ToString().ToLower(),
            entry.IsTrashed,
            entry.FolderId,
            HasSystemMessage: !string.IsNullOrEmpty(version?.SystemMessage),
            IsTemplate: version?.Prompts.Any(p => p.IsTemplate) ?? false,
            IsChain: (version?.Prompts.Count ?? 0) > 1,
            PromptCount: version?.Prompts.Count ?? 0,
            FirstPromptPreview: preview,
            entry.CreatedAt,
            entry.UpdatedAt
        );
    }
}
