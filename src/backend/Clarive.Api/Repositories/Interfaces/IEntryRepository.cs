using Clarive.Api.Models.Entities;
using Clarive.Api.Models.Responses;

namespace Clarive.Api.Repositories.Interfaces;

public interface IEntryRepository
{
    Task<(List<PromptEntry> Items, int TotalCount)> GetByFolderAsync(Guid tenantId, Guid? folderId, bool includeAll, EntryQueryOptions? options = null, CancellationToken ct = default);
    Task<(List<PromptEntry> Items, int TotalCount)> GetTrashedAsync(Guid tenantId, int page = 1, int pageSize = 50, CancellationToken ct = default);
    Task<PromptEntry?> GetByIdAsync(Guid tenantId, Guid entryId, CancellationToken ct = default);
    Task<Dictionary<Guid, PromptEntry>> GetByIdsAsync(Guid tenantId, IEnumerable<Guid> entryIds, CancellationToken ct = default);
    Task<PromptEntry> CreateAsync(PromptEntry entry, CancellationToken ct = default);
    Task<PromptEntry> UpdateAsync(PromptEntry entry, CancellationToken ct = default);
    Task<bool> DeleteAsync(Guid tenantId, Guid entryId, CancellationToken ct = default);

    // Version management
    Task<PromptEntryVersion?> GetWorkingVersionAsync(Guid tenantId, Guid entryId, CancellationToken ct = default);
    Task<Dictionary<Guid, PromptEntryVersion>> GetWorkingVersionsBatchAsync(Guid tenantId, List<Guid> entryIds, CancellationToken ct = default);
    Task<PromptEntryVersion?> GetVersionAsync(Guid tenantId, Guid entryId, int version, CancellationToken ct = default);
    Task<PromptEntryVersion?> GetPublishedVersionAsync(Guid tenantId, Guid entryId, CancellationToken ct = default);
    Task<Dictionary<Guid, PromptEntryVersion>> GetPublishedVersionsBatchAsync(Guid tenantId, List<Guid> entryIds, CancellationToken ct = default);
    Task<List<PromptEntryVersion>> GetVersionHistoryAsync(Guid tenantId, Guid entryId, CancellationToken ct = default);
    Task<int> GetMaxVersionNumberAsync(Guid tenantId, Guid entryId, CancellationToken ct = default);
    Task<PromptEntryVersion> CreateVersionAsync(PromptEntryVersion version, CancellationToken ct = default);
    Task<PromptEntryVersion> UpdateVersionAsync(PromptEntryVersion version, CancellationToken ct = default);
    Task DeleteVersionAsync(PromptEntryVersion version, CancellationToken ct = default);
    Task ReplacePromptsAsync(PromptEntryVersion version, List<Prompt> newPrompts, CancellationToken ct = default);
    Task CreateBatchAsync(List<PromptEntry> entries, List<PromptEntryVersion> versions, CancellationToken ct = default);

    // Dashboard
    Task<(int Total, int Published, int Drafts)> GetStatsAsync(Guid tenantId, CancellationToken ct = default);
    Task<List<RecentEntryDto>> GetRecentAsync(Guid tenantId, int limit, CancellationToken ct = default);
}
