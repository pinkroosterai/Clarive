using Clarive.Domain.Entities;

namespace Clarive.Domain.Interfaces.Repositories;

public interface IJobExecutionHistoryRepository
{
    Task<JobExecutionHistory> AddAsync(JobExecutionHistory record, CancellationToken ct = default);
    Task<(List<JobExecutionHistory> Items, int Total)> GetByJobNameAsync(
        string jobName,
        int page,
        int pageSize,
        CancellationToken ct = default
    );
    Task<List<JobExecutionHistory>> GetRecentFailuresAsync(int count, CancellationToken ct = default);
    Task<int> PurgeOlderThanAsync(DateTime cutoff, CancellationToken ct = default);
}
