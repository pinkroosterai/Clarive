using Clarive.AI.Models;
using Clarive.Domain.ValueObjects;
using Clarive.Api.Models.Requests;
using Clarive.Api.Models.Responses;
using ErrorOr;

namespace Clarive.Api.Services.Interfaces;

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
