using Clarive.AI.Models;
using Clarive.Domain.ValueObjects;
using Clarive.Core.Models.Requests;
using Clarive.Core.Models.Responses;
using ErrorOr;

namespace Clarive.Core.Services.Interfaces;

public interface IPlaygroundService
{
    Task<ErrorOr<TestStreamResult>> TestEntryAsync(
        Guid tenantId,
        Guid userId,
        Guid entryId,
        TestEntryRequest request,
        CancellationToken ct,
        Func<TestStreamChunk, Task>? onChunk = null
    );

    Task<ErrorOr<OutputEvaluation>> JudgePlaygroundRunAsync(
        Guid tenantId,
        Guid userId,
        Guid entryId,
        Guid runId,
        CancellationToken ct
    );
}
