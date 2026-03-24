using Clarive.Domain.Entities;
using Clarive.Domain.Enums;
using Clarive.Domain.Interfaces.Repositories;
using Clarive.Infrastructure.Data;
using Microsoft.EntityFrameworkCore;

namespace Clarive.Infrastructure.Repositories;

public class EfAbTestRepository(ClariveDbContext db) : IAbTestRepository
{
    public async Task<ABTestRun?> GetByIdAsync(Guid tenantId, Guid id, CancellationToken ct = default)
    {
        return await db.ABTestRuns
            .AsNoTracking()
            .Include(r => r.Results)
            .Where(r => r.TenantId == tenantId && r.Id == id)
            .FirstOrDefaultAsync(ct);
    }

    public async Task<List<ABTestRun>> GetByEntryIdAsync(Guid tenantId, Guid entryId, CancellationToken ct = default)
    {
        return await db.ABTestRuns
            .AsNoTracking()
            .Where(r => r.TenantId == tenantId && r.EntryId == entryId)
            .OrderByDescending(r => r.CreatedAt)
            .ToListAsync(ct);
    }

    public async Task<ABTestRun> CreateAsync(ABTestRun run, CancellationToken ct = default)
    {
        db.ABTestRuns.Add(run);
        await db.SaveChangesAsync(ct);
        return run;
    }

    public async Task UpdateStatusAsync(Guid id, ABTestStatus status, DateTime? completedAt = null, CancellationToken ct = default)
    {
        await db.ABTestRuns
            .Where(r => r.Id == id)
            .ExecuteUpdateAsync(s => s
                .SetProperty(r => r.Status, status)
                .SetProperty(r => r.CompletedAt, completedAt), ct);
    }

    public async Task<ABTestResult> AddResultAsync(ABTestResult result, CancellationToken ct = default)
    {
        db.ABTestResults.Add(result);
        await db.SaveChangesAsync(ct);
        return result;
    }

    public async Task<List<ABTestResult>> AddResultsAsync(List<ABTestResult> results, CancellationToken ct = default)
    {
        db.ABTestResults.AddRange(results);
        await db.SaveChangesAsync(ct);
        return results;
    }

    public async Task<bool> DeleteAsync(Guid tenantId, Guid id, CancellationToken ct = default)
    {
        var run = await db.ABTestRuns
            .Where(r => r.TenantId == tenantId && r.Id == id)
            .FirstOrDefaultAsync(ct);

        if (run is null)
            return false;

        db.ABTestRuns.Remove(run);
        await db.SaveChangesAsync(ct);
        return true;
    }
}
