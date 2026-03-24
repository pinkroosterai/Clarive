namespace Clarive.Application.AiGeneration.Contracts;

public record EnhanceRequest(Guid EntryId, Guid? TabId = null);
