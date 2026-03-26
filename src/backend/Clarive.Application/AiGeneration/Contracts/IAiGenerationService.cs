using Clarive.AI.Pipeline;
using Clarive.Domain.ValueObjects;
using ErrorOr;

namespace Clarive.Application.AiGeneration.Contracts;

public interface IAiGenerationService
{
    /// <summary>
    /// Generates a prompt set: builds config, calls orchestrator (which creates the agent session),
    /// persists session. Throws on orchestrator failure.
    /// </summary>
    Task<AiGenerationResult> GenerateAsync(
        Guid tenantId,
        Guid userId,
        GeneratePromptRequest request,
        CancellationToken ct = default,
        Func<ProgressEvent, Task>? onProgress = null
    );

    /// <summary>
    /// Refines an existing generation: resolves answers/enhancements, calls orchestrator, updates session.
    /// Throws on orchestrator failure.
    /// Returns error if the session is not found or invalid.
    /// </summary>
    Task<ErrorOr<AiGenerationResult>> RefineAsync(
        Guid tenantId,
        Guid userId,
        RefinePromptRequest request,
        CancellationToken ct = default,
        Func<ProgressEvent, Task>? onProgress = null
    );

    /// <summary>
    /// Validates and enhances an existing entry's prompts in a single atomic operation.
    /// Returns error on validation failure. Throws on orchestrator failure.
    /// </summary>
    Task<ErrorOr<AiGenerationResult>> EnhanceAsync(
        Guid tenantId,
        Guid userId,
        Guid entryId,
        Guid? tabId = null,
        CancellationToken ct = default,
        Func<ProgressEvent, Task>? onProgress = null
    );
}
