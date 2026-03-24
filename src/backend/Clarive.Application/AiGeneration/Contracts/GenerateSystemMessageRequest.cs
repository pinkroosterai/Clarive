namespace Clarive.Application.AiGeneration.Contracts;

public record GenerateSystemMessageRequest(Guid EntryId, Guid? TabId = null);
