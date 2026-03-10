using Clarive.Api.Data;
using Clarive.Api.Models.Entities;
using Clarive.Api.Repositories.Interfaces;
using Microsoft.EntityFrameworkCore;

namespace Clarive.Api.Repositories.EfCore;

public class EfTagRepository(ClariveDbContext db) : ITagRepository
{
    public async Task<List<(string TagName, int EntryCount)>> GetAllWithCountsAsync(Guid tenantId, CancellationToken ct = default)
    {
        var rows = await db.EntryTags
            .AsNoTracking()
            .Where(t => t.TenantId == tenantId)
            .GroupBy(t => t.TagName)
            .Select(g => new { TagName = g.Key, Count = g.Count() })
            .OrderBy(g => g.TagName)
            .ToListAsync(ct);

        return rows.Select(r => (r.TagName, r.Count)).ToList();
    }

    public async Task RenameAsync(Guid tenantId, string oldName, string newName, CancellationToken ct = default)
    {
        // Delete duplicates that would conflict after rename
        var entryIdsWithNewName = await db.EntryTags
            .Where(t => t.TenantId == tenantId && t.TagName == newName)
            .Select(t => t.EntryId)
            .ToListAsync(ct);

        if (entryIdsWithNewName.Count > 0)
        {
            await db.EntryTags
                .Where(t => t.TenantId == tenantId && t.TagName == oldName && entryIdsWithNewName.Contains(t.EntryId))
                .ExecuteDeleteAsync(ct);
        }

        await db.EntryTags
            .Where(t => t.TenantId == tenantId && t.TagName == oldName)
            .ExecuteUpdateAsync(s => s.SetProperty(t => t.TagName, newName), ct);
    }

    public async Task DeleteAsync(Guid tenantId, string tagName, CancellationToken ct = default)
    {
        await db.EntryTags
            .Where(t => t.TenantId == tenantId && t.TagName == tagName)
            .ExecuteDeleteAsync(ct);
    }

    public async Task<List<string>> GetByEntryIdAsync(Guid tenantId, Guid entryId, CancellationToken ct = default)
    {
        return await db.EntryTags
            .AsNoTracking()
            .Where(t => t.TenantId == tenantId && t.EntryId == entryId)
            .Select(t => t.TagName)
            .OrderBy(n => n)
            .ToListAsync(ct);
    }

    public async Task<Dictionary<Guid, List<string>>> GetByEntryIdsBatchAsync(Guid tenantId, List<Guid> entryIds, CancellationToken ct = default)
    {
        if (entryIds.Count == 0)
            return new Dictionary<Guid, List<string>>();

        var tags = await db.EntryTags
            .AsNoTracking()
            .Where(t => t.TenantId == tenantId && entryIds.Contains(t.EntryId))
            .Select(t => new { t.EntryId, t.TagName })
            .ToListAsync(ct);

        return tags
            .GroupBy(t => t.EntryId)
            .ToDictionary(g => g.Key, g => g.Select(t => t.TagName).OrderBy(n => n).ToList());
    }

    public async Task AddAsync(Guid tenantId, Guid entryId, List<string> tagNames, CancellationToken ct = default)
    {
        var existing = await db.EntryTags
            .Where(t => t.TenantId == tenantId && t.EntryId == entryId)
            .Select(t => t.TagName)
            .ToListAsync(ct);

        var existingSet = new HashSet<string>(existing);
        var now = DateTime.UtcNow;

        foreach (var name in tagNames)
        {
            if (existingSet.Contains(name)) continue;
            db.EntryTags.Add(new EntryTag
            {
                Id = Guid.NewGuid(),
                TenantId = tenantId,
                EntryId = entryId,
                TagName = name,
                CreatedAt = now
            });
        }

        await db.SaveChangesAsync(ct);
    }

    public async Task RemoveAsync(Guid tenantId, Guid entryId, string tagName, CancellationToken ct = default)
    {
        await db.EntryTags
            .Where(t => t.TenantId == tenantId && t.EntryId == entryId && t.TagName == tagName)
            .ExecuteDeleteAsync(ct);
    }

    public async Task<HashSet<Guid>> GetEntryIdsByTagsAsync(Guid tenantId, List<string> tags, bool matchAll, CancellationToken ct = default)
    {
        if (tags.Count == 0)
            return [];

        if (matchAll)
        {
            var entryIds = await db.EntryTags
                .AsNoTracking()
                .Where(t => t.TenantId == tenantId && tags.Contains(t.TagName))
                .GroupBy(t => t.EntryId)
                .Where(g => g.Select(t => t.TagName).Distinct().Count() == tags.Count)
                .Select(g => g.Key)
                .ToListAsync(ct);
            return entryIds.ToHashSet();
        }
        else
        {
            var entryIds = await db.EntryTags
                .AsNoTracking()
                .Where(t => t.TenantId == tenantId && tags.Contains(t.TagName))
                .Select(t => t.EntryId)
                .Distinct()
                .ToListAsync(ct);
            return entryIds.ToHashSet();
        }
    }
}
