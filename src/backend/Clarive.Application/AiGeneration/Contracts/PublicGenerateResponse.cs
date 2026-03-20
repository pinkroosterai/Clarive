namespace Clarive.Application.AiGeneration.Contracts;

public record PublicGenerateResponse(
    Guid Id,
    string Title,
    int Version,
    string? SystemMessage,
    List<RenderedPrompt> RenderedPrompts
);

public record RenderedPrompt(string Content, int Order);
