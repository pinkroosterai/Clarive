namespace Clarive.Api.Models.Requests;

public record AddTagsRequest(List<string> Tags);

public record RenameTagRequest(string NewName);
