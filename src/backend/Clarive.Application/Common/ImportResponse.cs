namespace Clarive.Application.Common;

public record ImportResponse(int ImportedCount, List<PromptEntrySummary> Entries);
