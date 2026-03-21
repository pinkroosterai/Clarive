using Clarive.Domain.QueryResults;
using Clarive.Infrastructure.Data;
using Clarive.Domain.Entities;
using Clarive.Domain.Interfaces.Repositories;
using Microsoft.EntityFrameworkCore;

namespace Clarive.Infrastructure.Repositories;

public class EfFolderRepository(ClariveDbContext db) : IFolderRepository
{
    public async Task<List<FolderDto>> GetTreeAsync(Guid tenantId, CancellationToken ct = default)
    {
        var all = await db
            .Folders.AsNoTracking()
            .Where(f => f.TenantId == tenantId)
            .ToListAsync(ct);
        var lookup = all.ToLookup(f => f.ParentId);

        FolderDto BuildNode(Folder f) =>
            new(
                f.Id,
                f.Name,
                f.ParentId,
                f.Color,
                lookup[f.Id].Select(BuildNode).OrderBy(c => c.Name).ToList()
            );

        return lookup[null].Select(BuildNode).OrderBy(f => f.Name).ToList();
    }

    public async Task<Folder?> GetByIdAsync(
        Guid tenantId,
        Guid folderId,
        CancellationToken ct = default
    )
    {
        return await db.Folders.FirstOrDefaultAsync(
            f => f.Id == folderId && f.TenantId == tenantId,
            ct
        );
    }

    public async Task<Dictionary<Guid, Folder>> GetByIdsAsync(
        Guid tenantId,
        IEnumerable<Guid> folderIds,
        CancellationToken ct = default
    )
    {
        var ids = folderIds.ToList();
        if (ids.Count == 0)
            return [];

        var folders = await db
            .Folders.AsNoTracking()
            .Where(f => f.TenantId == tenantId && ids.Contains(f.Id))
            .ToListAsync(ct);

        return folders.ToDictionary(f => f.Id);
    }

    public async Task<List<Folder>> GetChildrenAsync(
        Guid tenantId,
        Guid folderId,
        CancellationToken ct = default
    )
    {
        return await db
            .Folders.AsNoTracking()
            .Where(f => f.TenantId == tenantId && f.ParentId == folderId)
            .ToListAsync(ct);
    }

    public async Task<Folder> CreateAsync(Folder folder, CancellationToken ct = default)
    {
        db.Folders.Add(folder);
        await db.SaveChangesAsync(ct);
        return folder;
    }

    public async Task<Folder> UpdateAsync(Folder folder, CancellationToken ct = default)
    {
        await db.SaveChangesAsync(ct);
        return folder;
    }

    public async Task<bool> DeleteAsync(
        Guid tenantId,
        Guid folderId,
        CancellationToken ct = default
    )
    {
        var folder = await db.Folders.FirstOrDefaultAsync(
            f => f.Id == folderId && f.TenantId == tenantId,
            ct
        );
        if (folder is null)
            return false;
        db.Folders.Remove(folder);
        await db.SaveChangesAsync(ct);
        return true;
    }

    public async Task<bool> IsDescendantOfAsync(
        Guid tenantId,
        Guid folderId,
        Guid potentialAncestorId,
        CancellationToken ct = default
    )
    {
        // Recursive CTE walks only ancestors of folderId instead of loading all folders
        var result = await db
            .Database.SqlQuery<bool>(
                $"""
                WITH RECURSIVE ancestors AS (
                    SELECT parent_id FROM folders
                    WHERE id = {folderId} AND tenant_id = {tenantId}
                    UNION ALL
                    SELECT f.parent_id FROM folders f
                    INNER JOIN ancestors a ON f.id = a.parent_id
                    WHERE f.tenant_id = {tenantId}
                )
                SELECT EXISTS(
                    SELECT 1 FROM ancestors WHERE parent_id = {potentialAncestorId}
                ) AS "Value"
                """
            )
            .FirstOrDefaultAsync(ct);

        return result;
    }

    public async Task<int> GetCountAsync(Guid tenantId, CancellationToken ct = default)
    {
        return await db.Folders.AsNoTracking().CountAsync(f => f.TenantId == tenantId, ct);
    }
}
