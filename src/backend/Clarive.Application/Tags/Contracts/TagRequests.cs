namespace Clarive.Application.Tags.Contracts;

public record AddTagsRequest(List<string> Tags);

public record RenameTagRequest(string NewName);
