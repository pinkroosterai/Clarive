using Clarive.AI.Models;
using System.Text.Json;
using Clarive.Domain.ValueObjects;
using Clarive.Domain.Entities;
using Clarive.Domain.Interfaces.Repositories;

namespace Clarive.Application.Playground.Services;

public class PlaygroundRunService(IPlaygroundRunRepository runRepo) : IPlaygroundRunService
{
    private const int MaxRunsPerEntry = 20;
    private const int DefaultHistoryLimit = 10;

    private static readonly JsonSerializerOptions JsonOptions = new()
    {
        PropertyNamingPolicy = JsonNamingPolicy.CamelCase,
    };

    public async Task<PlaygroundRun> SaveRunAsync(PlaygroundRun run, CancellationToken ct)
    {
        var saved = await runRepo.AddAsync(run, ct);
        await runRepo.DeleteOldestByEntryIdAsync(run.EntryId, MaxRunsPerEntry, ct);
        return saved;
    }

    public async Task<PlaygroundRun?> GetByIdAsync(Guid runId, CancellationToken ct)
    {
        return await runRepo.GetByIdAsync(runId, ct);
    }

    public async Task UpdateRunAsync(PlaygroundRun run, CancellationToken ct)
    {
        await runRepo.UpdateAsync(run, ct);
    }

    public async Task<List<TestRunResponse>> GetRunsAsync(Guid entryId, CancellationToken ct)
    {
        var runs = await runRepo.GetByEntryIdAsync(entryId, DefaultHistoryLimit, ct);

        return runs.Select(r => new TestRunResponse(
                r.Id,
                r.Model,
                r.Temperature,
                r.MaxTokens,
                !string.IsNullOrEmpty(r.TemplateFieldValues)
                    ? JsonSerializer.Deserialize<Dictionary<string, string>>(
                        r.TemplateFieldValues,
                        JsonOptions
                    )
                    : null,
                !string.IsNullOrEmpty(r.ConversationLog)
                    ? JsonSerializer.Deserialize<List<ConversationMessage>>(
                        r.ConversationLog,
                        JsonOptions
                    ) ?? []
                    : [],
                null,
                null,
                r.CreatedAt,
                !string.IsNullOrEmpty(r.JudgeScores)
                    ? JsonSerializer.Deserialize<OutputEvaluation>(r.JudgeScores, JsonOptions)
                    : null,
                r.VersionNumber,
                r.VersionLabel
            ))
            .ToList();
    }
}
