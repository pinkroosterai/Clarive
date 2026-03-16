using System.Text.Json;
using Clarive.Api.Models.Entities;
using Clarive.Api.Models.Responses;
using Clarive.Api.Repositories.Interfaces;
using Clarive.Api.Services.Interfaces;

namespace Clarive.Api.Services;

public class PlaygroundRunService(IPlaygroundRunRepository runRepo) : IPlaygroundRunService
{
    private const int MaxRunsPerEntry = 20;
    private const int DefaultHistoryLimit = 10;

    private static readonly JsonSerializerOptions JsonOptions = new()
    {
        PropertyNamingPolicy = JsonNamingPolicy.CamelCase
    };

    public async Task<PlaygroundRun> SaveRunAsync(PlaygroundRun run, CancellationToken ct)
    {
        var saved = await runRepo.AddAsync(run, ct);
        await runRepo.DeleteOldestByEntryIdAsync(run.EntryId, MaxRunsPerEntry, ct);
        return saved;
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
                ? JsonSerializer.Deserialize<Dictionary<string, string>>(r.TemplateFieldValues, JsonOptions)
                : null,
            JsonSerializer.Deserialize<List<TestRunPromptResponse>>(r.Responses, JsonOptions) ?? [],
            null, null, // Token counts not stored in historical runs
            r.CreatedAt
        )).ToList();
    }
}
