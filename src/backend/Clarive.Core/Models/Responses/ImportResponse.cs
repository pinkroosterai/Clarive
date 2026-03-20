namespace Clarive.Core.Models.Responses;

public record ImportResponse(int ImportedCount, List<PromptEntrySummary> Entries);
