using Clarive.Domain.Entities;
using Clarive.Domain.QueryResults;

namespace Clarive.Domain.Interfaces.Repositories;

public interface IEntryRepository
{
    Task<(List<PromptEntry> Items, int TotalCount)> GetByFolderAsync(
        Guid tenantId,
        Guid? folderId,
        bool includeAll,
        EntryQueryOptions? options = null,
        CancellationToken ct = default
    );
    Task<(List<PromptEntry> Items, int TotalCount)> GetTrashedAsync(
        Guid tenantId,
        int page = 1,
        int pageSize = 50,
        CancellationToken ct = default
    );
    Task<PromptEntry?> GetByIdAsync(Guid tenantId, Guid entryId, CancellationToken ct = default);
    Task<Dictionary<Guid, PromptEntry>> GetByIdsAsync(
        Guid tenantId,
        IEnumerable<Guid> entryIds,
        CancellationToken ct = default
    );
    Task<List<PromptEntry>> GetByFolderIdsAsync(
        Guid tenantId,
        IEnumerable<Guid> folderIds,
        CancellationToken ct = default
    );
    Task<PromptEntry> CreateAsync(PromptEntry entry, CancellationToken ct = default);
    Task<PromptEntry> UpdateAsync(PromptEntry entry, CancellationToken ct = default);
    Task<bool> DeleteAsync(Guid tenantId, Guid entryId, CancellationToken ct = default);

    // Version management
    Task<PromptEntryVersion?> GetWorkingVersionAsync(
        Guid tenantId,
        Guid entryId,
        CancellationToken ct = default
    );
    Task<Dictionary<Guid, PromptEntryVersion>> GetWorkingVersionsBatchAsync(
        Guid tenantId,
        List<Guid> entryIds,
        CancellationToken ct = default
    );
    Task<PromptEntryVersion?> GetVersionAsync(
        Guid tenantId,
        Guid entryId,
        int version,
        CancellationToken ct = default
    );
    Task<PromptEntryVersion?> GetPublishedVersionAsync(
        Guid tenantId,
        Guid entryId,
        CancellationToken ct = default
    );
    Task<Dictionary<Guid, PromptEntryVersion>> GetPublishedVersionsBatchAsync(
        Guid tenantId,
        List<Guid> entryIds,
        CancellationToken ct = default
    );
    Task<List<PromptEntryVersion>> GetVersionHistoryAsync(
        Guid tenantId,
        Guid entryId,
        CancellationToken ct = default
    );
    Task<int> GetMaxVersionNumberAsync(Guid tenantId, Guid entryId, CancellationToken ct = default);
    Task<PromptEntryVersion> CreateVersionAsync(
        PromptEntryVersion version,
        CancellationToken ct = default
    );
    Task<PromptEntryVersion> UpdateVersionAsync(
        PromptEntryVersion version,
        CancellationToken ct = default
    );
    Task DeleteVersionAsync(PromptEntryVersion version, CancellationToken ct = default);
    Task ReplacePromptsAsync(
        PromptEntryVersion version,
        List<Prompt> newPrompts,
        CancellationToken ct = default
    );
    Task CreateBatchAsync(
        List<PromptEntry> entries,
        List<PromptEntryVersion> versions,
        CancellationToken ct = default
    );

    // Variant management
    Task<List<PromptEntryVersion>> GetVariantsAsync(
        Guid tenantId,
        Guid entryId,
        CancellationToken ct = default
    );
    Task<PromptEntryVersion?> GetVariantByNameAsync(
        Guid tenantId,
        Guid entryId,
        string variantName,
        CancellationToken ct = default
    );
    Task<PromptEntryVersion?> GetVersionByIdAsync(
        Guid tenantId,
        Guid versionId,
        CancellationToken ct = default
    );

    // Tree (minimal projection for sidebar)
    Task<List<(Guid Id, string Title, Guid? FolderId)>> GetTreeAsync(
        Guid tenantId,
        CancellationToken ct = default
    );

    // Dashboard
    Task<(int Total, int Published, int Drafts)> GetStatsAsync(
        Guid tenantId,
        CancellationToken ct = default
    );
    Task<List<RecentEntryDto>> GetRecentAsync(
        Guid tenantId,
        int limit,
        CancellationToken ct = default
    );
}
