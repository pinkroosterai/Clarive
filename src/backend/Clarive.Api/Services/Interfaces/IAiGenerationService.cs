using Clarive.Api.Models.Requests;
using Clarive.Api.Models.Results;
using Clarive.Api.Models.Agents;
using Clarive.Api.Services.Agents.AiExtensions;

namespace Clarive.Api.Services.Interfaces;

public interface IAiGenerationService
{
    /// <summary>
    /// Generates a prompt set: builds config, calls orchestrator (which creates the agent session),
    /// persists session. Throws on orchestrator failure.
    /// </summary>
    Task<AiGenerationResult> GenerateAsync(
        Guid tenantId, GeneratePromptRequest request, CancellationToken ct = default,
        Func<ProgressEvent, Task>? onProgress = null);

    /// <summary>
    /// Refines an existing generation: resolves answers/enhancements, calls orchestrator, updates session.
    /// Throws on orchestrator failure.
    /// Returns null if the session is not found.
    /// Returns an error string if the session is invalid.
    /// </summary>
    Task<(AiGenerationResult? Result, string? ErrorCode, string? ErrorMessage)> RefineAsync(
        Guid tenantId, RefinePromptRequest request, CancellationToken ct = default,
        Func<ProgressEvent, Task>? onProgress = null);

    /// <summary>
    /// Validates and enhances an existing entry's prompts in a single atomic operation.
    /// Returns error tuple on validation failure. Throws on orchestrator failure.
    /// </summary>
    Task<(AiGenerationResult? Result, string? ErrorCode, string? ErrorMessage)> EnhanceAsync(
        Guid tenantId, Guid entryId, CancellationToken ct = default,
        Func<ProgressEvent, Task>? onProgress = null);

    /// <summary>
    /// Validates and generates a system message for an existing entry in a single atomic operation.
    /// Returns error tuple on validation failure. Throws on orchestrator failure.
    /// </summary>
    Task<(string? SystemMessage, string? ErrorCode, string? ErrorMessage)> GenerateSystemMessageAsync(
        Guid tenantId, Guid entryId, CancellationToken ct = default);

    /// <summary>
    /// Validates and decomposes a single-prompt entry into a chain in a single atomic operation.
    /// Returns error tuple on validation failure. Throws on orchestrator failure.
    /// </summary>
    Task<(List<PromptInput>? Prompts, string? ErrorCode, string? ErrorMessage)> DecomposeAsync(
        Guid tenantId, Guid entryId, CancellationToken ct = default);
}
