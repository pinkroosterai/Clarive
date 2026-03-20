namespace Clarive.Application.ImportExport.Contracts;

public record ImportResponse(int ImportedCount, List<PromptEntryDto> Entries);
