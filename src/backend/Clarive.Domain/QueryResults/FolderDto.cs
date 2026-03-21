namespace Clarive.Domain.QueryResults;

public record FolderDto(Guid Id, string Name, Guid? ParentId, string? Color, List<FolderDto> Children);
