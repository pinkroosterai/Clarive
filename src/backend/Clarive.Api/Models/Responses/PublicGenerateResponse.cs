namespace Clarive.Api.Models.Responses;

public record PublicGenerateResponse(
    Guid Id,
    string Title,
    int Version,
    string? SystemMessage,
    List<RenderedPrompt> RenderedPrompts
);

public record RenderedPrompt(string Content, int Order);
