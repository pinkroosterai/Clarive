namespace Clarive.Application.Tags;

public record AddTagsRequest(List<string> Tags);

public record RenameTagRequest(string NewName);
