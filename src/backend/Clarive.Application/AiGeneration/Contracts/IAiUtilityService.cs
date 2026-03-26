using Clarive.AI.Pipeline;
using Clarive.Domain.ValueObjects;
using ErrorOr;

namespace Clarive.Application.AiGeneration.Contracts;

public interface IAiUtilityService
{
    /// <summary>
    /// Validates and generates a system message for an existing entry in a single atomic operation.
    /// Returns error on validation failure. Throws on orchestrator failure.
    /// </summary>
    Task<ErrorOr<string>> GenerateSystemMessageAsync(
        Guid tenantId,
        Guid userId,
        Guid entryId,
        Guid? tabId = null,
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
        Guid? tabId = null,
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
        Guid? tabId = null,
        CancellationToken ct = default
    );

    /// <summary>
    /// Rewrites a rough user description into a clear, structured description
    /// suitable for AI prompt generation. Returns the polished text.
    /// </summary>
    Task<ErrorOr<string>> PolishDescriptionAsync(
        Guid tenantId,
        Guid userId,
        string description,
        CancellationToken ct = default
    );

    /// <summary>
    /// Merges two conflicting versions of a field using AI.
    /// Returns the merged text for user review.
    /// </summary>
    Task<ErrorOr<string>> ResolveMergeConflictAsync(
        Guid tenantId,
        Guid userId,
        string fieldName,
        string versionA,
        string versionB,
        CancellationToken ct = default
    );

    /// <summary>
    /// Evaluates prompt content against quality dimensions (Clarity, Effectiveness, Completeness, Faithfulness).
    /// Standalone evaluation — decoupled from the generate/refine/enhance workflows.
    /// </summary>
    Task<ErrorOr<EvaluationDto>> EvaluateAsync(
        Guid tenantId,
        Guid userId,
        EvaluateEntryRequest request,
        CancellationToken ct = default
    );
}
