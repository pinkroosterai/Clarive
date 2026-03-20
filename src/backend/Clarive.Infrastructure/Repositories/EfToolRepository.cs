using Clarive.Infrastructure.Data;
using Clarive.Domain.Entities;
using Clarive.Domain.Interfaces.Repositories;
using Microsoft.EntityFrameworkCore;

namespace Clarive.Infrastructure.Repositories;

public class EfToolRepository(ClariveDbContext db) : IToolRepository
{
    public async Task<List<ToolDescription>> GetByTenantAsync(
        Guid tenantId,
        CancellationToken ct = default
    )
    {
        return await db
            .ToolDescriptions.AsNoTracking()
            .Where(t => t.TenantId == tenantId)
            .ToListAsync(ct);
    }

    public async Task<(List<ToolDescription> Tools, int Total)> GetByTenantPagedAsync(
        Guid tenantId,
        int page,
        int pageSize,
        CancellationToken ct = default
    )
    {
        var query = db.ToolDescriptions.AsNoTracking().Where(t => t.TenantId == tenantId);
        var total = await query.CountAsync(ct);
        var tools = await query
            .OrderBy(t => t.Name)
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .ToListAsync(ct);
        return (tools, total);
    }

    public async Task<ToolDescription?> GetByIdAsync(
        Guid tenantId,
        Guid toolId,
        CancellationToken ct = default
    )
    {
        return await db.ToolDescriptions.FirstOrDefaultAsync(
            t => t.Id == toolId && t.TenantId == tenantId,
            ct
        );
    }

    public async Task<List<ToolDescription>> GetByIdsAsync(
        Guid tenantId,
        IEnumerable<Guid> toolIds,
        CancellationToken ct = default
    )
    {
        var ids = toolIds.ToList();
        if (ids.Count == 0)
            return [];
        return await db
            .ToolDescriptions.AsNoTracking()
            .Where(t => t.TenantId == tenantId && ids.Contains(t.Id))
            .ToListAsync(ct);
    }

    public async Task<ToolDescription> CreateAsync(
        ToolDescription tool,
        CancellationToken ct = default
    )
    {
        db.ToolDescriptions.Add(tool);
        await db.SaveChangesAsync(ct);
        return tool;
    }

    public async Task<ToolDescription> UpdateAsync(
        ToolDescription tool,
        CancellationToken ct = default
    )
    {
        db.ToolDescriptions.Update(tool);
        await db.SaveChangesAsync(ct);
        return tool;
    }

    public async Task<bool> DeleteAsync(Guid tenantId, Guid toolId, CancellationToken ct = default)
    {
        var tool = await db.ToolDescriptions.FirstOrDefaultAsync(
            t => t.Id == toolId && t.TenantId == tenantId,
            ct
        );
        if (tool is null)
            return false;
        db.ToolDescriptions.Remove(tool);
        await db.SaveChangesAsync(ct);
        return true;
    }

    public async Task CreateManyAsync(List<ToolDescription> tools, CancellationToken ct = default)
    {
        db.ToolDescriptions.AddRange(tools);
        await db.SaveChangesAsync(ct);
    }
}
