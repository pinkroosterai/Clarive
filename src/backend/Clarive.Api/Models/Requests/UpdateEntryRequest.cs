namespace Clarive.Api.Models.Requests;

public record UpdateEntryRequest(
    string? Title,
    string? SystemMessage,
    List<PromptInput>? Prompts
);
