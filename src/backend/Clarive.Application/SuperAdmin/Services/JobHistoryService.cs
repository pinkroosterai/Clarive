using Clarive.Application.SuperAdmin.Contracts;
using Clarive.Domain.Entities;
using Clarive.Domain.Interfaces.Repositories;
using ErrorOr;

namespace Clarive.Application.SuperAdmin.Services;

public class JobHistoryService(IJobExecutionHistoryRepository repo) : IJobHistoryService
{
    private const int MaxPageSize = 200;
    private const int MaxFailureCount = 100;

    public async Task<ErrorOr<(List<JobExecutionHistory> Items, int Total)>> GetHistoryByJobAsync(
        string jobName,
        int page,
        int pageSize,
        CancellationToken ct = default)
    {
        if (string.IsNullOrWhiteSpace(jobName))
            return Error.Validation("INVALID_JOB_NAME", "Job name is required.");

        if (page < 1)
            return Error.Validation("INVALID_PAGE", "Page must be >= 1.");

        if (pageSize < 1 || pageSize > MaxPageSize)
            return Error.Validation("INVALID_PAGE_SIZE", $"Page size must be between 1 and {MaxPageSize}.");

        return await repo.GetByJobNameAsync(jobName, page, pageSize, ct);
    }

    public async Task<ErrorOr<List<JobExecutionHistory>>> GetRecentFailuresAsync(
        int count,
        CancellationToken ct = default)
    {
        if (count < 1 || count > MaxFailureCount)
            return Error.Validation("INVALID_COUNT", $"Count must be between 1 and {MaxFailureCount}.");

        return await repo.GetRecentFailuresAsync(count, ct);
    }
}
