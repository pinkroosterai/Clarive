using Clarive.Domain.Entities;
using Clarive.Domain.Interfaces.Repositories;
using Clarive.Infrastructure.Data;
using Microsoft.EntityFrameworkCore;

namespace Clarive.Infrastructure.Repositories;

public class EfJobExecutionHistoryRepository(ClariveDbContext db) : IJobExecutionHistoryRepository
{
    public async Task<JobExecutionHistory> AddAsync(JobExecutionHistory record, CancellationToken ct = default)
    {
        db.JobExecutionHistories.Add(record);
        await db.SaveChangesAsync(ct);
        return record;
    }

    public async Task<(List<JobExecutionHistory> Items, int Total)> GetByJobNameAsync(
        string jobName,
        int page,
        int pageSize,
        CancellationToken ct = default)
    {
        var query = db.JobExecutionHistories
            .AsNoTracking()
            .Where(h => h.JobName == jobName);

        var total = await query.CountAsync(ct);
        var items = await query
            .OrderByDescending(h => h.FireTimeUtc)
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .ToListAsync(ct);

        return (items, total);
    }

    public async Task<List<JobExecutionHistory>> GetRecentFailuresAsync(
        int count,
        CancellationToken ct = default)
    {
        return await db.JobExecutionHistories
            .AsNoTracking()
            .Where(h => !h.Succeeded)
            .OrderByDescending(h => h.FireTimeUtc)
            .Take(count)
            .ToListAsync(ct);
    }

    public async Task<int> PurgeOlderThanAsync(DateTime cutoff, CancellationToken ct = default)
    {
        return await db.JobExecutionHistories
            .Where(h => h.FireTimeUtc < cutoff)
            .ExecuteDeleteAsync(ct);
    }
}
