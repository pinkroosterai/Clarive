namespace Clarive.Api.Repositories.Interfaces;

public interface ITagRepository
{
    Task<List<(string TagName, int EntryCount)>> GetAllWithCountsAsync(Guid tenantId, CancellationToken ct = default);
    Task RenameAsync(Guid tenantId, string oldName, string newName, CancellationToken ct = default);
    Task DeleteAsync(Guid tenantId, string tagName, CancellationToken ct = default);
    Task<List<string>> GetByEntryIdAsync(Guid tenantId, Guid entryId, CancellationToken ct = default);
    Task<Dictionary<Guid, List<string>>> GetByEntryIdsBatchAsync(Guid tenantId, List<Guid> entryIds, CancellationToken ct = default);
    Task AddAsync(Guid tenantId, Guid entryId, List<string> tagNames, CancellationToken ct = default);
    Task RemoveAsync(Guid tenantId, Guid entryId, string tagName, CancellationToken ct = default);
    Task<HashSet<Guid>> GetEntryIdsByTagsAsync(Guid tenantId, List<string> tags, bool matchAll, CancellationToken ct = default);
    IQueryable<Guid> GetEntryIdsByTagsQuery(Guid tenantId, List<string> tags, bool matchAll);
}
