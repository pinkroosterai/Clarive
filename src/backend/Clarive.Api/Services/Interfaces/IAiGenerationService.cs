using Clarive.Api.Models.Requests;
using Clarive.Api.Models.Results;
using Clarive.Api.Models.Agents;

namespace Clarive.Api.Services.Interfaces;

public interface IAiGenerationService
{
    /// <summary>
    /// Runs the pre-generation clarification step: builds config, calls orchestrator, persists session.
    /// Returns a result with session ID, questions, and enhancements.
    /// </summary>
    Task<AiGenerationResult> PreGenClarifyAsync(
        Guid tenantId, string description,
        bool generateSystemMessage, bool generateTemplate, bool generateChain,
        List<Guid>? toolIds, CancellationToken ct = default,
        Func<string, Task>? onProgress = null);

    /// <summary>
    /// Generates a prompt set: resolves session, builds config, calls orchestrator, persists session.
    /// Throws on orchestrator failure (caller should refund credits).
    /// Returns null if the referenced session is not found.
    /// </summary>
    Task<AiGenerationResult?> GenerateAsync(
        Guid tenantId, GeneratePromptRequest request, CancellationToken ct = default,
        Func<string, Task>? onProgress = null);

    /// <summary>
    /// Refines an existing generation: resolves answers/enhancements, calls orchestrator, updates session.
    /// Throws on orchestrator failure (caller should refund credits).
    /// Returns null if the session is not found.
    /// Returns an error string if the session is invalid.
    /// </summary>
    Task<(AiGenerationResult? Result, string? ErrorCode, string? ErrorMessage)> RefineAsync(
        Guid tenantId, RefinePromptRequest request, CancellationToken ct = default,
        Func<string, Task>? onProgress = null);

    /// <summary>
    /// Validates that an entry exists and has a version suitable for enhancement.
    /// Call before credit deduction. Returns (true, null, null) on success.
    /// </summary>
    Task<(bool Valid, string? ErrorCode, string? ErrorMessage)> ValidateEntryForEnhanceAsync(
        Guid tenantId, Guid entryId, CancellationToken ct = default);

    /// <summary>
    /// Enhances an existing entry's prompts. Call after credit deduction.
    /// Throws on orchestrator failure (caller should refund credits).
    /// </summary>
    Task<AiGenerationResult?> EnhanceAsync(
        Guid tenantId, Guid entryId, CancellationToken ct = default,
        Func<string, Task>? onProgress = null);

    /// <summary>
    /// Validates that an entry exists, has a version, and no system message.
    /// Call before credit deduction. Returns (true, null, null) on success.
    /// </summary>
    Task<(bool Valid, string? ErrorCode, string? ErrorMessage)> ValidateEntryForSystemMessageAsync(
        Guid tenantId, Guid entryId, CancellationToken ct = default);

    /// <summary>
    /// Generates a system message for an existing entry. Call after credit deduction.
    /// Throws on orchestrator failure (caller should refund credits).
    /// </summary>
    Task<(string? SystemMessage, string? ErrorCode, string? ErrorMessage)> GenerateSystemMessageAsync(
        Guid tenantId, Guid entryId, CancellationToken ct = default);

    /// <summary>
    /// Validates that an entry exists, has a version, and exactly one prompt.
    /// Call before credit deduction. Returns (true, null, null) on success.
    /// </summary>
    Task<(bool Valid, string? ErrorCode, string? ErrorMessage)> ValidateEntryForDecomposeAsync(
        Guid tenantId, Guid entryId, CancellationToken ct = default);

    /// <summary>
    /// Decomposes a single-prompt entry into a chain. Call after credit deduction.
    /// Throws on orchestrator failure (caller should refund credits).
    /// </summary>
    Task<(List<PromptInput>? Prompts, string? ErrorCode, string? ErrorMessage)> DecomposeAsync(
        Guid tenantId, Guid entryId, CancellationToken ct = default);
}
