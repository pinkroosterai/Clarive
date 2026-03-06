namespace Clarive.Api.Models.Requests;

public record CreateEntryRequest(
    string Title,
    string? SystemMessage,
    List<PromptInput> Prompts,
    Guid? FolderId
);

public record PromptInput(string Content, bool IsTemplate = false);
