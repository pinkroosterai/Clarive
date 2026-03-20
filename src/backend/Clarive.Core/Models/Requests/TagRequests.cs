namespace Clarive.Core.Models.Requests;

public record AddTagsRequest(List<string> Tags);

public record RenameTagRequest(string NewName);
