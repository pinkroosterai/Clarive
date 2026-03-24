namespace Clarive.Application.AiGeneration.Contracts;

public record DecomposeRequest(Guid EntryId, Guid? TabId = null);
