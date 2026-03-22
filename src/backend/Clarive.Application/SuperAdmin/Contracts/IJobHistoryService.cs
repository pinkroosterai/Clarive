using Clarive.Domain.Entities;
using ErrorOr;

namespace Clarive.Application.SuperAdmin.Contracts;

public interface IJobHistoryService
{
    Task<ErrorOr<(List<JobExecutionHistory> Items, int Total)>> GetHistoryByJobAsync(
        string jobName,
        int page,
        int pageSize,
        CancellationToken ct = default
    );

    Task<ErrorOr<List<JobExecutionHistory>>> GetRecentFailuresAsync(
        int count,
        CancellationToken ct = default
    );
}
