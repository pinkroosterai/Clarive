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
    /// Validates that an entry exists and has a version suitable for enhancement.
    /// Returns (true, null, null) on success.
    /// </summary>
    Task<(bool Valid, string? ErrorCode, string? ErrorMessage)> ValidateEntryForEnhanceAsync(
        Guid tenantId, Guid entryId, CancellationToken ct = default);

    /// <summary>
    /// Enhances an existing entry's prompts.    /// Throws on orchestrator failure.
    /// </summary>
    Task<AiGenerationResult?> EnhanceAsync(
        Guid tenantId, Guid entryId, CancellationToken ct = default,
        Func<ProgressEvent, Task>? onProgress = null);

    /// <summary>
    /// Validates that an entry exists, has a version, and no system message.
    /// Returns (true, null, null) on success.
    /// </summary>
    Task<(bool Valid, string? ErrorCode, string? ErrorMessage)> ValidateEntryForSystemMessageAsync(
        Guid tenantId, Guid entryId, CancellationToken ct = default);

    /// <summary>
    /// Generates a system message for an existing entry.    /// Throws on orchestrator failure.
    /// </summary>
    Task<(string? SystemMessage, string? ErrorCode, string? ErrorMessage)> GenerateSystemMessageAsync(
        Guid tenantId, Guid entryId, CancellationToken ct = default);

    /// <summary>
    /// Validates that an entry exists, has a version, and exactly one prompt.
    /// Returns (true, null, null) on success.
    /// </summary>
    Task<(bool Valid, string? ErrorCode, string? ErrorMessage)> ValidateEntryForDecomposeAsync(
        Guid tenantId, Guid entryId, CancellationToken ct = default);

    /// <summary>
    /// Decomposes a single-prompt entry into a chain.    /// Throws on orchestrator failure.
    /// </summary>
    Task<(List<PromptInput>? Prompts, string? ErrorCode, string? ErrorMessage)> DecomposeAsync(
        Guid tenantId, Guid entryId, CancellationToken ct = default);
}
