using System.Diagnostics;
using Clarive.AI.Agents;
using Clarive.AI.Evaluation;
using Clarive.AI.Models;
using Clarive.AI.Orchestration;
using Clarive.AI.Pipeline;
using Clarive.AI.Prompts;
using Clarive.Domain.Entities;
using Clarive.Domain.Enums;
using Clarive.Domain.Errors;
using Clarive.Domain.Interfaces.Repositories;
using Clarive.Domain.Interfaces.Services;
using Clarive.Domain.ValueObjects;
using ErrorOr;
using Microsoft.Extensions.AI;

namespace Clarive.Application.AiGeneration.Services;

public class AiUtilityService(
    IPromptOrchestrator orchestrator,
    IEntryRepository entryRepo,
    IAiUsageLogger usageLogger,
    IAgentFactory agentFactory
) : IAiUtilityService
{
    public async Task<ErrorOr<string>> GenerateSystemMessageAsync(
        Guid tenantId,
        Guid userId,
        Guid entryId,
        Guid? tabId,
        CancellationToken ct
    )
    {
        var workingResult = await GetValidatedWorkingVersionAsync(tenantId, entryId, tabId, ct);
        if (workingResult.IsError)
            return workingResult.Errors;

        var (entry, working) = workingResult.Value;

        if (!string.IsNullOrEmpty(working.SystemMessage))
            return Error.Conflict("ALREADY_EXISTS", "Entry already has a system message.");

        var promptInputs = working
            .Prompts.OrderBy(p => p.Order)
            .Select(p => new PromptInput(p.Content, p.IsTemplate))
            .ToList();

        var sw = Stopwatch.StartNew();
        var agentResult = await orchestrator.GenerateSystemMessageAsync(promptInputs, ct);
        sw.Stop();

        await LogUsageAsync(
            tenantId,
            userId,
            AiActionType.SystemMessage,
            sw.ElapsedMilliseconds,
            agentResult.Usage,
            entryId,
            ct
        );

        return agentResult.Value;
    }

    public async Task<ErrorOr<List<PromptInput>>> DecomposeAsync(
        Guid tenantId,
        Guid userId,
        Guid entryId,
        Guid? tabId,
        CancellationToken ct
    )
    {
        var workingResult = await GetValidatedWorkingVersionAsync(tenantId, entryId, tabId, ct);
        if (workingResult.IsError)
            return workingResult.Errors;

        var (entry, working) = workingResult.Value;

        if (working.Prompts.Count != 1)
            return Error.Conflict(
                "ALREADY_CHAIN",
                "Entry must have exactly one prompt to decompose."
            );

        var prompt = working.Prompts.OrderBy(p => p.Order).First();

        var sw = Stopwatch.StartNew();
        var agentResult = await orchestrator.DecomposeAsync(
            prompt.Content,
            prompt.IsTemplate,
            working.SystemMessage,
            ct
        );
        sw.Stop();

        await LogUsageAsync(
            tenantId,
            userId,
            AiActionType.Decomposition,
            sw.ElapsedMilliseconds,
            agentResult.Usage,
            entryId,
            ct
        );

        return agentResult.Value;
    }

    public async Task<ErrorOr<Dictionary<string, string>>> FillTemplateFieldsAsync(
        Guid tenantId,
        Guid userId,
        Guid entryId,
        Guid? tabId,
        CancellationToken ct
    )
    {
        var workingResult = await GetValidatedWorkingVersionAsync(tenantId, entryId, tabId, ct);
        if (workingResult.IsError)
            return workingResult.Errors;

        var (entry, working) = workingResult.Value;

        var prompts = working.Prompts.OrderBy(p => p.Order).ToList();
        var allFields = prompts
            .Where(p => p.IsTemplate)
            .SelectMany(p => p.TemplateFields)
            .DistinctBy(f => f.Name)
            .ToList();

        if (allFields.Count == 0)
            return Error.Validation("NO_TEMPLATE_FIELDS", "Entry has no template fields.");

        var fieldInfos = allFields
            .Select(f => new TemplateFieldInfo(
                f.Name,
                f.Type.ToString().ToLowerInvariant(),
                f.EnumValues,
                f.Min,
                f.Max,
                null
            ))
            .ToList();

        var promptInputs = prompts.Select(p => new PromptInput(p.Content, p.IsTemplate)).ToList();

        var sw = Stopwatch.StartNew();
        var agentResult = await orchestrator.FillTemplateFieldsAsync(
            fieldInfos,
            promptInputs,
            working.SystemMessage,
            ct
        );
        sw.Stop();

        await LogUsageAsync(
            tenantId,
            userId,
            AiActionType.FillTemplateFields,
            sw.ElapsedMilliseconds,
            agentResult.Usage,
            entryId,
            ct
        );

        return agentResult.Value;
    }

    public async Task<ErrorOr<string>> PolishDescriptionAsync(
        Guid tenantId,
        Guid userId,
        string description,
        CancellationToken ct
    )
    {
        if (string.IsNullOrWhiteSpace(description))
            return Error.Validation("VALIDATION_ERROR", "Description is required.");

        if (description.Length > 2000)
            return Error.Validation("VALIDATION_ERROR", "Description must be 2000 characters or fewer.");

        var sw = Stopwatch.StartNew();
        var result = await orchestrator.PolishDescriptionAsync(description, ct);
        sw.Stop();

        await LogUsageAsync(
            tenantId,
            userId,
            AiActionType.PolishDescription,
            sw.ElapsedMilliseconds,
            result.Usage,
            ct
        );

        return result.Value;
    }

    public async Task<ErrorOr<string>> ResolveMergeConflictAsync(
        Guid tenantId,
        Guid userId,
        string fieldName,
        string versionA,
        string versionB,
        CancellationToken ct
    )
    {
        if (string.IsNullOrWhiteSpace(fieldName))
            return Error.Validation("VALIDATION_ERROR", "Field name is required.");

        if (string.IsNullOrWhiteSpace(versionA) && string.IsNullOrWhiteSpace(versionB))
            return Error.Validation("VALIDATION_ERROR", "At least one version must have content.");

        var sw = Stopwatch.StartNew();
        var result = await orchestrator.ResolveMergeConflictAsync(fieldName, versionA, versionB, ct);
        sw.Stop();

        await LogUsageAsync(
            tenantId,
            userId,
            AiActionType.MergeConflict,
            sw.ElapsedMilliseconds,
            result.Usage,
            ct
        );

        return result.Value;
    }

    public async Task<ErrorOr<EvaluationDto>> EvaluateAsync(
        Guid tenantId,
        Guid userId,
        EvaluateEntryRequest request,
        CancellationToken ct
    )
    {
        var promptMessages = request.Prompts
            .OrderBy(p => p.SortOrder)
            .Select(p => new PromptMessage { Content = p.Content })
            .ToList();

        var hasTemplateVars = promptMessages.Any(p => p.Content.Contains("{{"));

        var config = new GenerationConfig
        {
            Description = request.Description ?? "Evaluate prompt quality",
            GenerateSystemMessage = request.SystemMessage != null,
            GenerateAsPromptTemplate = hasTemplateVars,
            GenerateAsPromptChain = promptMessages.Count > 1,
        };

        var prompts = new PromptSet
        {
            SystemMessage = request.SystemMessage,
            Prompts = promptMessages,
        };

        var sw = Stopwatch.StartNew();
        var (evaluation, usage) = await orchestrator.EvaluateAsync(config, prompts, ct);
        sw.Stop();

        await LogUsageAsync(
            tenantId,
            userId,
            AiActionType.Evaluation,
            sw.ElapsedMilliseconds,
            usage,
            ct
        );

        var mapped = MapEvaluation(evaluation);
        if (mapped is null)
            return Error.Failure("EVALUATION_FAILED", "Evaluation could not be completed. Please try again.");

        return mapped;
    }

    // ── Private helpers ──

    private async Task<ErrorOr<(PromptEntry Entry, PromptEntryVersion Working)>> GetValidatedWorkingVersionAsync(
        Guid tenantId,
        Guid entryId,
        Guid? tabId,
        CancellationToken ct
    )
    {
        var entry = await entryRepo.GetByIdAsync(tenantId, entryId, ct);
        if (entry is null || entry.IsTrashed)
            return DomainErrors.EntryNotFound;

        var version = await entryRepo.GetWorkingVersionAsync(tenantId, entryId, tabId, ct);
        if (version is null)
            return DomainErrors.VersionNotFoundForEntry;

        return (entry, version);
    }

    private Task LogUsageAsync(
        Guid tenantId,
        Guid userId,
        AiActionType actionType,
        long durationMs,
        UsageDetails? usage,
        CancellationToken ct
    ) => LogUsageAsync(tenantId, userId, actionType, durationMs, usage, null, ct);

    private Task LogUsageAsync(
        Guid tenantId,
        Guid userId,
        AiActionType actionType,
        long durationMs,
        UsageDetails? usage,
        Guid? entryId,
        CancellationToken ct
    )
    {
        if (usage is null)
            return Task.CompletedTask;

        var (modelId, providerName) = agentFactory.GetModelInfo(actionType);

        return usageLogger.LogAsync(
            tenantId,
            userId,
            actionType,
            modelId ?? "unknown",
            providerName ?? "unknown",
            usage.InputTokenCount ?? 0,
            usage.OutputTokenCount ?? 0,
            durationMs,
            entryId,
            ct
        );
    }

    private static EvaluationDto? MapEvaluation(PromptEvaluation? evaluation)
    {
        if (evaluation is null)
            return null;
        return new EvaluationDto(
            evaluation.PromptEvaluations.ToDictionary(
                kvp => kvp.Key,
                kvp => new EvaluationEntryDto(kvp.Value.Score, kvp.Value.Feedback)
            )
        );
    }
}
