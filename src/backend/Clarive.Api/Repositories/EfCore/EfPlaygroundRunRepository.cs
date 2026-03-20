using Clarive.Api.Data;
using Clarive.Domain.Entities;
using Clarive.Domain.Interfaces.Repositories;
using Microsoft.EntityFrameworkCore;

namespace Clarive.Api.Repositories.EfCore;

public class EfPlaygroundRunRepository(ClariveDbContext db) : IPlaygroundRunRepository
{
    public async Task<PlaygroundRun?> GetByIdAsync(Guid runId, CancellationToken ct = default)
    {
        return await db.PlaygroundRuns.FirstOrDefaultAsync(r => r.Id == runId, ct);
    }

    public async Task UpdateAsync(PlaygroundRun run, CancellationToken ct = default)
    {
        db.PlaygroundRuns.Update(run);
        await db.SaveChangesAsync(ct);
    }

    public async Task<List<PlaygroundRun>> GetByEntryIdAsync(
        Guid entryId,
        int limit,
        CancellationToken ct = default
    )
    {
        return await db
            .PlaygroundRuns.Where(r => r.EntryId == entryId)
            .OrderByDescending(r => r.CreatedAt)
            .Take(limit)
            .ToListAsync(ct);
    }

    public async Task<PlaygroundRun> AddAsync(PlaygroundRun run, CancellationToken ct = default)
    {
        db.PlaygroundRuns.Add(run);
        await db.SaveChangesAsync(ct);
        return run;
    }

    public async Task<int> DeleteOlderThanAsync(DateTime cutoff, CancellationToken ct = default)
    {
        return await db.PlaygroundRuns.Where(r => r.CreatedAt < cutoff).ExecuteDeleteAsync(ct);
    }

    public async Task<int> CountByEntryIdAsync(Guid entryId, CancellationToken ct = default)
    {
        return await db.PlaygroundRuns.CountAsync(r => r.EntryId == entryId, ct);
    }

    public async Task DeleteOldestByEntryIdAsync(
        Guid entryId,
        int keepCount,
        CancellationToken ct = default
    )
    {
        var idsToDelete = await db
            .PlaygroundRuns.Where(r => r.EntryId == entryId)
            .OrderByDescending(r => r.CreatedAt)
            .Skip(keepCount)
            .Select(r => r.Id)
            .ToListAsync(ct);

        if (idsToDelete.Count > 0)
        {
            await db.PlaygroundRuns.Where(r => idsToDelete.Contains(r.Id)).ExecuteDeleteAsync(ct);
        }
    }
}
