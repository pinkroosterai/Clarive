using Clarive.Application.AbTests.Contracts;
using Clarive.Application.Playground.Contracts;
using Clarive.Domain.Entities;
using Clarive.Domain.Enums;
using Clarive.Domain.Errors;
using Clarive.Domain.Interfaces.Repositories;
using Clarive.Domain.ValueObjects;
using ErrorOr;
using Microsoft.Extensions.Logging;

namespace Clarive.Application.AbTests.Services;

public class AbTestService(
    IAbTestRepository abTestRepo,
    ITestDatasetRepository datasetRepo,
    IEntryRepository entryRepo,
    IPlaygroundService playgroundService,
    ILogger<AbTestService> logger
) : IAbTestService
{
    public async Task<ErrorOr<List<AbTestRunResponse>>> ListAsync(
        Guid tenantId, Guid entryId, CancellationToken ct = default)
    {
        var entry = await entryRepo.GetByIdAsync(tenantId, entryId, ct);
        if (entry is null)
            return DomainErrors.EntryNotFound;

        var runs = await abTestRepo.GetByEntryIdAsync(tenantId, entryId, ct);

        // Enrich with dataset names
        var datasetIds = runs.Where(r => r.DatasetId.HasValue).Select(r => r.DatasetId!.Value).Distinct().ToList();
        var datasetNames = new Dictionary<Guid, string>();
        foreach (var dsId in datasetIds)
        {
            var ds = await datasetRepo.GetByIdAsync(tenantId, dsId, ct);
            if (ds is not null)
                datasetNames[dsId] = ds.Name;
        }

        return runs.Select(r => new AbTestRunResponse(
            r.Id,
            r.VersionAId,
            r.VersionBId,
            r.VersionALabel,
            r.VersionBLabel,
            r.DatasetId.HasValue && datasetNames.TryGetValue(r.DatasetId.Value, out var name) ? name : null,
            r.Model,
            r.Status.ToString(),
            r.Results.Count,
            r.CreatedAt,
            r.CompletedAt
        )).ToList();
    }

    public async Task<ErrorOr<AbTestRunDetailResponse>> GetAsync(
        Guid tenantId, Guid entryId, Guid runId, CancellationToken ct = default)
    {
        var run = await abTestRepo.GetByIdAsync(tenantId, runId, ct);
        if (run is null || run.EntryId != entryId)
            return DomainErrors.AbTestRunNotFound;

        // Load dataset info
        string? datasetName = null;
        var rowValues = new Dictionary<Guid, Dictionary<string, string>>();
        if (run.DatasetId.HasValue)
        {
            var dataset = await datasetRepo.GetByIdAsync(tenantId, run.DatasetId.Value, ct);
            if (dataset is not null)
            {
                datasetName = dataset.Name;
                foreach (var row in dataset.Rows)
                    rowValues[row.Id] = row.Values;
            }
        }

        var results = run.Results
            .Select(r => new AbTestResultResponse(
                r.Id,
                r.DatasetRowId,
                rowValues.TryGetValue(r.DatasetRowId, out var vals) ? vals : null,
                r.VersionAOutput,
                r.VersionBOutput,
                r.VersionAScores,
                r.VersionBScores,
                r.VersionAAvgScore,
                r.VersionBAvgScore
            ))
            .ToList();

        var summary = ComputeSummary(run.Results);

        return new AbTestRunDetailResponse(
            run.Id,
            run.VersionAId,
            run.VersionBId,
            run.VersionALabel,
            run.VersionBLabel,
            datasetName,
            run.Model,
            run.Status.ToString(),
            run.Results.Count,
            run.CreatedAt,
            run.CompletedAt,
            results,
            summary
        );
    }

    public async Task<ErrorOr<bool>> DeleteAsync(
        Guid tenantId, Guid entryId, Guid runId, CancellationToken ct = default)
    {
        // Verify entry ownership before deleting
        var run = await abTestRepo.GetByIdAsync(tenantId, runId, ct);
        if (run is null || run.EntryId != entryId)
            return DomainErrors.AbTestRunNotFound;

        await abTestRepo.DeleteAsync(tenantId, runId, ct);
        return true;
    }

    public async Task<ErrorOr<AbTestRunDetailResponse>> RunAsync(
        Guid tenantId, Guid userId, Guid entryId, StartAbTestRequest request,
        Func<AbTestProgressEvent, Task>? onProgress = null, CancellationToken ct = default)
    {
        var validationErr = Common.Validator.ValidateAndGetError(request);
        if (validationErr is not null)
            return validationErr.Value;

        // Validate entry
        var entry = await entryRepo.GetByIdAsync(tenantId, entryId, ct);
        if (entry is null)
            return DomainErrors.EntryNotFound;

        // Validate both versions exist and belong to this entry
        var versionA = await entryRepo.GetVersionByIdAsync(tenantId, request.VersionAId, ct);
        var versionB = await entryRepo.GetVersionByIdAsync(tenantId, request.VersionBId, ct);
        if (versionA is null || versionB is null || versionA.EntryId != entryId || versionB.EntryId != entryId)
            return DomainErrors.AbTestVersionNotFound;

        // Validate dataset has rows and belongs to the entry
        var dataset = await datasetRepo.GetByIdAsync(tenantId, request.DatasetId, ct);
        if (dataset is null || dataset.EntryId != entryId)
            return DomainErrors.TestDatasetNotFound;
        if (dataset.Rows.Count == 0)
            return DomainErrors.AbTestDatasetEmpty;

        // Compute labels for display
        var labelA = ComputeVersionLabel(versionA);
        var labelB = ComputeVersionLabel(versionB);

        // Create run entity
        var run = new ABTestRun
        {
            Id = Guid.NewGuid(),
            TenantId = tenantId,
            EntryId = entryId,
            UserId = userId,
            VersionAId = versionA.Id,
            VersionBId = versionB.Id,
            VersionALabel = labelA,
            VersionBLabel = labelB,
            DatasetId = request.DatasetId,
            Model = request.Model,
            Temperature = request.Temperature,
            MaxTokens = request.MaxTokens,
            Status = ABTestStatus.Running,
            CreatedAt = DateTime.UtcNow,
        };
        await abTestRepo.CreateAsync(run, ct);

        if (onProgress is not null)
            await onProgress(new AbTestProgressEvent("starting", 0, dataset.Rows.Count, null, "Starting A/B test..."));

        var results = new List<ABTestResult>();

        try
        {
            for (var i = 0; i < dataset.Rows.Count; i++)
            {
                var row = dataset.Rows[i];
                ct.ThrowIfCancellationRequested();

                if (onProgress is not null)
                    await onProgress(new AbTestProgressEvent("running", i + 1, dataset.Rows.Count, $"{labelA} & {labelB}", $"Testing input {i + 1}/{dataset.Rows.Count}"));

                // Run both versions in parallel
                var testRequest = new TestEntryRequest(
                    Model: request.Model,
                    Temperature: request.Temperature,
                    MaxTokens: request.MaxTokens,
                    TemplateFields: row.Values,
                    ReasoningEffort: request.ReasoningEffort
                );

                var taskA = playgroundService.TestEntryAsync(tenantId, userId, entryId, testRequest, ct, versionId: versionA.Id);
                var taskB = playgroundService.TestEntryAsync(tenantId, userId, entryId, testRequest, ct, versionId: versionB.Id);
                await Task.WhenAll(taskA, taskB);

                var resultA = await taskA;
                var resultB = await taskB;

                var outputA = resultA.IsError ? null : ExtractAssistantOutput(resultA.Value.ConversationLog);
                var scoresA = resultA.IsError ? null : resultA.Value.JudgeScores;
                var outputB = resultB.IsError ? null : ExtractAssistantOutput(resultB.Value.ConversationLog);
                var scoresB = resultB.IsError ? null : resultB.Value.JudgeScores;

                if (onProgress is not null)
                    await onProgress(new AbTestProgressEvent("judging", i + 1, dataset.Rows.Count, null, $"Scored input {i + 1}/{dataset.Rows.Count}"));

                results.Add(new ABTestResult
                {
                    Id = Guid.NewGuid(),
                    RunId = run.Id,
                    DatasetRowId = row.Id,
                    VersionAOutput = outputA,
                    VersionBOutput = outputB,
                    VersionAScores = scoresA?.Dimensions,
                    VersionBScores = scoresB?.Dimensions,
                    VersionAAvgScore = scoresA?.AverageScore,
                    VersionBAvgScore = scoresB?.AverageScore,
                });
            }

            // Batch insert all results at once
            if (results.Count > 0)
                await abTestRepo.AddResultsAsync(results, ct);

            await abTestRepo.UpdateStatusAsync(run.Id, ABTestStatus.Completed, DateTime.UtcNow, ct);
            run.Status = ABTestStatus.Completed;
            run.CompletedAt = DateTime.UtcNow;

            logger.LogInformation("A/B test completed: {RunId} for entry {EntryId}, {ResultCount} results",
                run.Id, entryId, results.Count);
        }
        catch (OperationCanceledException)
        {
            await abTestRepo.UpdateStatusAsync(run.Id, ABTestStatus.Failed, DateTime.UtcNow, CancellationToken.None);
            throw;
        }
        catch (Exception ex)
        {
            logger.LogError(ex, "A/B test failed: {RunId} for entry {EntryId}", run.Id, entryId);
            await abTestRepo.UpdateStatusAsync(run.Id, ABTestStatus.Failed, DateTime.UtcNow, CancellationToken.None);
            run.Status = ABTestStatus.Failed;
            run.CompletedAt = DateTime.UtcNow;
        }

        if (onProgress is not null)
            await onProgress(new AbTestProgressEvent("completed", dataset.Rows.Count, dataset.Rows.Count, null, "A/B test completed."));

        // Build response
        run.Results = results;
        var summary = ComputeSummary(results);

        var rowValues = dataset.Rows.ToDictionary(r => r.Id, r => r.Values);
        var resultResponses = results.Select(r => new AbTestResultResponse(
            r.Id, r.DatasetRowId,
            rowValues.TryGetValue(r.DatasetRowId, out var vals) ? vals : null,
            r.VersionAOutput, r.VersionBOutput,
            r.VersionAScores, r.VersionBScores,
            r.VersionAAvgScore, r.VersionBAvgScore
        )).ToList();

        return new AbTestRunDetailResponse(
            run.Id, run.VersionAId, run.VersionBId,
            run.VersionALabel, run.VersionBLabel,
            dataset.Name, run.Model, run.Status.ToString(),
            results.Count, run.CreatedAt, run.CompletedAt,
            resultResponses, summary
        );
    }

    internal static string ComputeVersionLabel(PromptEntryVersion version)
    {
        return version.VersionState switch
        {
            VersionState.Published => $"v{version.Version} (published)",
            VersionState.Historical => $"v{version.Version}",
            VersionState.Tab => version.TabName ?? "Tab",
            _ => $"v{version.Version}"
        };
    }

    private static string? ExtractAssistantOutput(List<ConversationMessage> conversationLog)
    {
        return conversationLog
            .Where(m => m.Role == "assistant" && !string.IsNullOrEmpty(m.Content))
            .Select(m => m.Content)
            .LastOrDefault();
    }

    internal static AggregateSummary? ComputeSummary(List<ABTestResult> results)
    {
        if (results.Count == 0)
            return null;

        var scored = results.Where(r => r.VersionAAvgScore.HasValue && r.VersionBAvgScore.HasValue).ToList();
        if (scored.Count == 0)
            return null;

        var versionAAvg = scored.Average(r => r.VersionAAvgScore!.Value);
        var versionBAvg = scored.Average(r => r.VersionBAvgScore!.Value);
        var deltaPercent = versionAAvg > 0 ? ((versionBAvg - versionAAvg) / versionAAvg) * 100 : 0;

        var versionAWins = scored.Count(r => r.VersionAAvgScore > r.VersionBAvgScore);
        var versionBWins = scored.Count(r => r.VersionBAvgScore > r.VersionAAvgScore);
        var ties = scored.Count(r => Math.Abs(r.VersionAAvgScore!.Value - r.VersionBAvgScore!.Value) < 0.01);

        // Per-dimension comparison
        var perDimension = new Dictionary<string, DimensionComparison>();
        var allDimensions = scored
            .SelectMany(r =>
                (r.VersionAScores?.Keys ?? Enumerable.Empty<string>())
                .Union(r.VersionBScores?.Keys ?? Enumerable.Empty<string>()))
            .Distinct()
            .ToList();

        foreach (var dim in allDimensions)
        {
            var aScores = scored
                .Where(r => r.VersionAScores?.ContainsKey(dim) == true)
                .Select(r => (double)r.VersionAScores![dim].Score)
                .ToList();
            var bScores = scored
                .Where(r => r.VersionBScores?.ContainsKey(dim) == true)
                .Select(r => (double)r.VersionBScores![dim].Score)
                .ToList();

            if (aScores.Count > 0 && bScores.Count > 0)
            {
                var aAvg = aScores.Average();
                var bAvg = bScores.Average();
                perDimension[dim] = new DimensionComparison(
                    Math.Round(aAvg, 2),
                    Math.Round(bAvg, 2),
                    Math.Round(bAvg - aAvg, 2)
                );
            }
        }

        return new AggregateSummary(
            Math.Round(versionAAvg, 2),
            Math.Round(versionBAvg, 2),
            Math.Round(deltaPercent, 1),
            versionAWins,
            versionBWins,
            ties,
            perDimension
        );
    }
}
