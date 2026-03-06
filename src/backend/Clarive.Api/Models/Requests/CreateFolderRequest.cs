namespace Clarive.Api.Models.Requests;

public record CreateFolderRequest(string Name, Guid? ParentId);
