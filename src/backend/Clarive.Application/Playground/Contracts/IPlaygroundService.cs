using Clarive.AI.Models;
using Clarive.AI.Pipeline;
using Clarive.Domain.ValueObjects;
using ErrorOr;

namespace Clarive.Application.Playground.Contracts;

public interface IPlaygroundService
{
    Task<ErrorOr<TestStreamResult>> TestEntryAsync(
        Guid tenantId,
        Guid userId,
        Guid entryId,
        TestEntryRequest request,
        CancellationToken ct,
        Func<ConversationStreamEvent, Task>? onEvent = null
    );

    Task<ErrorOr<OutputEvaluation>> JudgePlaygroundRunAsync(
        Guid tenantId,
        Guid userId,
        Guid entryId,
        Guid runId,
        CancellationToken ct
    );

    Task<List<TestRunResponse>> GetRunsAsync(Guid entryId, CancellationToken ct);
}
