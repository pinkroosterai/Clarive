using Clarive.Api.Data;
using Clarive.Api.Models.Entities;
using Clarive.Api.Models.Enums;
using Clarive.Api.Models.Responses;
using Clarive.Api.Repositories.Interfaces;
using Microsoft.EntityFrameworkCore;

namespace Clarive.Api.Repositories.EfCore;

public class EfEntryRepository(ClariveDbContext db) : IEntryRepository
{
    public async Task<(List<PromptEntry> Items, int TotalCount)> GetByFolderAsync(Guid tenantId, Guid? folderId, bool includeAll, EntryQueryOptions? options = null, CancellationToken ct = default)
    {
        options ??= new EntryQueryOptions();

        var query = db.PromptEntries.AsNoTracking().Where(e => e.TenantId == tenantId && !e.IsTrashed);
        if (!includeAll)
            query = query.Where(e => e.FolderId == folderId);
        if (options.FilteredEntryIds is not null)
            query = query.Where(e => options.FilteredEntryIds.Contains(e.Id));
        if (!string.IsNullOrWhiteSpace(options.Search))
            query = query.Where(e => EF.Functions.ILike(e.Title, $"%{options.Search}%"));
        if (string.Equals(options.Status, "draft", StringComparison.OrdinalIgnoreCase))
        {
            var publishedEntryIds = db.PromptEntryVersions.AsNoTracking()
                .Where(v => v.VersionState == VersionState.Published)
                .Select(v => v.EntryId).Distinct();
            query = query.Where(e => !publishedEntryIds.Contains(e.Id));
        }
        else if (string.Equals(options.Status, "published", StringComparison.OrdinalIgnoreCase))
        {
            var publishedEntryIds = db.PromptEntryVersions.AsNoTracking()
                .Where(v => v.VersionState == VersionState.Published)
                .Select(v => v.EntryId).Distinct();
            query = query.Where(e => publishedEntryIds.Contains(e.Id));
        }

        IOrderedQueryable<PromptEntry> ordered = options.SortBy switch
        {
            "alphabetical" => query.OrderBy(e => e.Title),
            "oldest" => query.OrderBy(e => e.UpdatedAt),
            _ => query.OrderByDescending(e => e.UpdatedAt),
        };

        var totalCount = await ordered.CountAsync(ct);
        var items = await ordered.Skip((options.Page - 1) * options.PageSize).Take(options.PageSize).ToListAsync(ct);
        return (items, totalCount);
    }

    public async Task<(List<PromptEntry> Items, int TotalCount)> GetTrashedAsync(Guid tenantId, int page = 1, int pageSize = 50, CancellationToken ct = default)
    {
        var query = db.PromptEntries
            .AsNoTracking()
            .Where(e => e.TenantId == tenantId && e.IsTrashed)
            .OrderByDescending(e => e.UpdatedAt);

        var totalCount = await query.CountAsync(ct);
        var items = await query.Skip((page - 1) * pageSize).Take(pageSize).ToListAsync(ct);
        return (items, totalCount);
    }

    public async Task<PromptEntry?> GetByIdAsync(Guid tenantId, Guid entryId, CancellationToken ct = default)
    {
        return await db.PromptEntries
            .FirstOrDefaultAsync(e => e.Id == entryId && e.TenantId == tenantId, ct);
    }

    public async Task<Dictionary<Guid, PromptEntry>> GetByIdsAsync(Guid tenantId, IEnumerable<Guid> entryIds, CancellationToken ct = default)
    {
        var ids = entryIds.ToList();
        if (ids.Count == 0) return new Dictionary<Guid, PromptEntry>();
        return await db.PromptEntries
            .AsNoTracking()
            .Where(e => e.TenantId == tenantId && ids.Contains(e.Id))
            .ToDictionaryAsync(e => e.Id, ct);
    }

    public async Task<List<PromptEntry>> GetByFolderIdsAsync(Guid tenantId, IEnumerable<Guid> folderIds, CancellationToken ct = default)
    {
        var ids = folderIds.ToList();
        if (ids.Count == 0) return [];
        return await db.PromptEntries
            .AsNoTracking()
            .Where(e => e.TenantId == tenantId && !e.IsTrashed && e.FolderId.HasValue && ids.Contains(e.FolderId.Value))
            .ToListAsync(ct);
    }

    public async Task<PromptEntry> CreateAsync(PromptEntry entry, CancellationToken ct = default)
    {
        db.PromptEntries.Add(entry);
        await db.SaveChangesAsync(ct);
        return entry;
    }

    public async Task<PromptEntry> UpdateAsync(PromptEntry entry, CancellationToken ct = default)
    {
        await db.SaveChangesAsync(ct);
        return entry;
    }

    public async Task<bool> DeleteAsync(Guid tenantId, Guid entryId, CancellationToken ct = default)
    {
        var entry = await db.PromptEntries.FirstOrDefaultAsync(e => e.Id == entryId && e.TenantId == tenantId, ct);
        if (entry is null) return false;
        db.PromptEntries.Remove(entry);
        await db.SaveChangesAsync(ct);
        return true;
    }

    // ── Version Management ──

    private IQueryable<PromptEntryVersion> VersionsWithIncludes =>
        db.PromptEntryVersions
            .Include(v => v.Prompts.OrderBy(p => p.Order))
            .ThenInclude(p => p.TemplateFields)
            .AsSplitQuery();

    private IQueryable<PromptEntryVersion> TenantVersions(Guid tenantId) =>
        VersionsWithIncludes.Where(v => v.Entry.TenantId == tenantId);

    private IQueryable<PromptEntryVersion> TenantVersionsReadOnly(Guid tenantId) =>
        TenantVersions(tenantId).AsNoTracking();

    public async Task<PromptEntryVersion?> GetWorkingVersionAsync(Guid tenantId, Guid entryId, CancellationToken ct = default)
    {
        // Prefer draft; fall back to published. OrderBy ensures Draft (0) comes before Published (1).
        return await TenantVersions(tenantId)
            .Where(v => v.EntryId == entryId
                        && (v.VersionState == VersionState.Draft || v.VersionState == VersionState.Published))
            .OrderBy(v => v.VersionState)
            .FirstOrDefaultAsync(ct);
    }

    public async Task<Dictionary<Guid, PromptEntryVersion>> GetWorkingVersionsBatchAsync(
        Guid tenantId, List<Guid> entryIds, CancellationToken ct = default)
    {
        if (entryIds.Count == 0) return [];

        // Single query: get all draft/published versions for the given entries
        var versions = await TenantVersionsReadOnly(tenantId)
            .Where(v => entryIds.Contains(v.EntryId)
                        && (v.VersionState == VersionState.Draft || v.VersionState == VersionState.Published))
            .ToListAsync(ct);

        // Group by entry, prefer draft over published
        return versions
            .GroupBy(v => v.EntryId)
            .ToDictionary(
                g => g.Key,
                g => g.FirstOrDefault(v => v.VersionState == VersionState.Draft)
                     ?? g.First(v => v.VersionState == VersionState.Published));
    }

    public async Task<PromptEntryVersion?> GetVersionAsync(Guid tenantId, Guid entryId, int version, CancellationToken ct = default)
    {
        return await TenantVersions(tenantId)
            .FirstOrDefaultAsync(v => v.EntryId == entryId && v.Version == version, ct);
    }

    public async Task<PromptEntryVersion?> GetPublishedVersionAsync(Guid tenantId, Guid entryId, CancellationToken ct = default)
    {
        return await TenantVersions(tenantId)
            .FirstOrDefaultAsync(v => v.EntryId == entryId && v.VersionState == VersionState.Published, ct);
    }

    public async Task<Dictionary<Guid, PromptEntryVersion>> GetPublishedVersionsBatchAsync(
        Guid tenantId, List<Guid> entryIds, CancellationToken ct = default)
    {
        if (entryIds.Count == 0) return [];

        var versions = await TenantVersionsReadOnly(tenantId)
            .Where(v => entryIds.Contains(v.EntryId) && v.VersionState == VersionState.Published)
            .ToListAsync(ct);

        return versions.ToDictionary(v => v.EntryId);
    }

    public async Task<List<PromptEntryVersion>> GetVersionHistoryAsync(Guid tenantId, Guid entryId, CancellationToken ct = default)
    {
        return await TenantVersionsReadOnly(tenantId)
            .Where(v => v.EntryId == entryId)
            .OrderByDescending(v => v.Version)
            .ToListAsync(ct);
    }

    public async Task<int> GetMaxVersionNumberAsync(Guid tenantId, Guid entryId, CancellationToken ct = default)
    {
        return await db.PromptEntryVersions
            .Where(v => v.EntryId == entryId && v.Entry.TenantId == tenantId)
            .MaxAsync(v => (int?)v.Version, ct) ?? 0;
    }

    public async Task<PromptEntryVersion> CreateVersionAsync(PromptEntryVersion version, CancellationToken ct = default)
    {
        db.PromptEntryVersions.Add(version);
        await db.SaveChangesAsync(ct);
        return version;
    }

    public async Task<PromptEntryVersion> UpdateVersionAsync(PromptEntryVersion version, CancellationToken ct = default)
    {
        await db.SaveChangesAsync(ct);
        return version;
    }

    public async Task DeleteVersionAsync(PromptEntryVersion version, CancellationToken ct = default)
    {
        db.PromptEntryVersions.Remove(version);
        await db.SaveChangesAsync(ct);
    }

    public async Task CreateBatchAsync(List<PromptEntry> entries, List<PromptEntryVersion> versions, CancellationToken ct = default)
    {
        db.PromptEntries.AddRange(entries);
        db.PromptEntryVersions.AddRange(versions);
        await db.SaveChangesAsync(ct);
    }

    public async Task ReplacePromptsAsync(PromptEntryVersion version, List<Prompt> newPrompts, CancellationToken ct = default)
    {
        // Clear existing prompts — EF Core will delete orphans for required relationships
        version.Prompts.Clear();

        // Add new prompts and explicitly mark as Added
        foreach (var p in newPrompts)
        {
            p.VersionId = version.Id;
            version.Prompts.Add(p);
            db.Entry(p).State = EntityState.Added;
            // Also mark template fields as Added
            foreach (var tf in p.TemplateFields)
                db.Entry(tf).State = EntityState.Added;
        }

        await db.SaveChangesAsync(ct);
    }

    // ── Dashboard ──

    public async Task<(int Total, int Published, int Drafts)> GetStatsAsync(Guid tenantId, CancellationToken ct = default)
    {
        var entries = db.PromptEntries.AsNoTracking()
            .Where(e => e.TenantId == tenantId && !e.IsTrashed);

        var total = await entries.CountAsync(ct);

        // Count entries that have a published working version
        var published = await db.PromptEntryVersions.AsNoTracking()
            .Where(v => v.Entry.TenantId == tenantId && !v.Entry.IsTrashed && v.VersionState == VersionState.Published)
            .Select(v => v.EntryId)
            .Distinct()
            .CountAsync(ct);

        return (total, published, total - published);
    }

    public async Task<List<RecentEntryDto>> GetRecentAsync(Guid tenantId, int limit, CancellationToken ct = default)
    {
        var entries = await db.PromptEntries.AsNoTracking()
            .Where(e => e.TenantId == tenantId && !e.IsTrashed)
            .OrderByDescending(e => e.UpdatedAt)
            .Take(limit)
            .ToListAsync(ct);

        if (entries.Count == 0) return [];

        // Batch-fetch working versions for version state
        var entryIds = entries.Select(e => e.Id).ToList();
        var versions = await db.PromptEntryVersions.AsNoTracking()
            .Where(v => entryIds.Contains(v.EntryId)
                        && (v.VersionState == VersionState.Draft || v.VersionState == VersionState.Published))
            .ToListAsync(ct);

        var versionMap = versions
            .GroupBy(v => v.EntryId)
            .ToDictionary(
                g => g.Key,
                g => g.FirstOrDefault(v => v.VersionState == VersionState.Draft)
                     ?? g.First(v => v.VersionState == VersionState.Published));

        return entries.Select(e =>
        {
            var state = versionMap.TryGetValue(e.Id, out var v)
                ? v.VersionState.ToString().ToLower()
                : "draft";
            return new RecentEntryDto(e.Id, e.Title, state, e.UpdatedAt);
        }).ToList();
    }

}
