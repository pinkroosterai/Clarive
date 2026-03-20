using Clarive.Infrastructure.Data;
using Clarive.Domain.Entities;
using Clarive.Domain.Interfaces.Repositories;
using Microsoft.EntityFrameworkCore;

namespace Clarive.Infrastructure.Repositories;

public class EfMcpServerRepository(ClariveDbContext db) : IMcpServerRepository
{
    public async Task<List<McpServer>> GetByTenantAsync(
        Guid tenantId,
        CancellationToken ct = default
    )
    {
        return await db
            .McpServers.AsNoTracking()
            .Where(s => s.TenantId == tenantId)
            .OrderBy(s => s.Name)
            .ToListAsync(ct);
    }

    public async Task<McpServer?> GetByIdAsync(
        Guid tenantId,
        Guid serverId,
        CancellationToken ct = default
    )
    {
        return await db.McpServers.FirstOrDefaultAsync(
            s => s.Id == serverId && s.TenantId == tenantId,
            ct
        );
    }

    public async Task<List<McpServer>> GetDueForSyncAsync(CancellationToken ct = default)
    {
        return await db
            .McpServers.AsNoTracking()
            .Where(s => s.IsActive && s.NextSyncAt != null && s.NextSyncAt <= DateTime.UtcNow)
            .ToListAsync(ct);
    }

    public async Task<McpServer> CreateAsync(McpServer server, CancellationToken ct = default)
    {
        db.McpServers.Add(server);
        await db.SaveChangesAsync(ct);
        return server;
    }

    public async Task<McpServer> UpdateAsync(McpServer server, CancellationToken ct = default)
    {
        db.McpServers.Update(server);
        await db.SaveChangesAsync(ct);
        return server;
    }

    public async Task<bool> DeleteAsync(Guid tenantId, Guid serverId, CancellationToken ct = default)
    {
        var server = await db.McpServers.FirstOrDefaultAsync(
            s => s.Id == serverId && s.TenantId == tenantId,
            ct
        );
        if (server is null)
            return false;
        db.McpServers.Remove(server);
        await db.SaveChangesAsync(ct);
        return true;
    }
}
