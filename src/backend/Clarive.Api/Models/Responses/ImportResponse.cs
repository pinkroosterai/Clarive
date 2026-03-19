namespace Clarive.Api.Models.Responses;

public record ImportResponse(int ImportedCount, List<PromptEntrySummary> Entries);
