namespace Clarive.Api.Models.Responses;

public record FolderDto(Guid Id, string Name, Guid? ParentId, List<FolderDto> Children);
