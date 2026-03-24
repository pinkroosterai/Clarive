namespace Clarive.Application.AiGeneration.Contracts;

public record FillTemplateFieldsRequest(Guid EntryId, Guid? TabId = null);
