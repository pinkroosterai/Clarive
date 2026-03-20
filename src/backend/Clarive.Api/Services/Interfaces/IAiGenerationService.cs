using Clarive.AI.Extensions;
using Clarive.Domain.ValueObjects;
using Clarive.Api.Models.Requests;
using Clarive.Api.Models.Results;
using ErrorOr;

namespace Clarive.Api.Services.Interfaces;

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
        CancellationToken ct = default,
        Func<ProgressEvent, Task>? onProgress = null
    );

    /// <summary>
    /// Validates and generates a system message for an existing entry in a single atomic operation.
    /// Returns error on validation failure. Throws on orchestrator failure.
    /// </summary>
    Task<ErrorOr<string>> GenerateSystemMessageAsync(
        Guid tenantId,
        Guid userId,
        Guid entryId,
        CancellationToken ct = default
    );

    /// <summary>
    /// Generates contextually relevant example values for an entry's template fields.
    /// Returns error if entry not found or has no template fields.
    /// </summary>
    Task<ErrorOr<Dictionary<string, string>>> FillTemplateFieldsAsync(
        Guid tenantId,
        Guid userId,
        Guid entryId,
        CancellationToken ct = default
    );

    /// <summary>
    /// Validates and decomposes a single-prompt entry into a chain in a single atomic operation.
    /// Returns error on validation failure. Throws on orchestrator failure.
    /// </summary>
    Task<ErrorOr<List<PromptInput>>> DecomposeAsync(
        Guid tenantId,
        Guid userId,
        Guid entryId,
        CancellationToken ct = default
    );
}
