namespace Clarive.Domain.QueryResults;

public record FolderDto(Guid Id, string Name, Guid? ParentId, List<FolderDto> Children);
