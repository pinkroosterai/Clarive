namespace Clarive.Api.Models.Responses;

public record TestRunResponse(
    Guid Id,
    string Model,
    float Temperature,
    int MaxTokens,
    Dictionary<string, string>? TemplateFieldValues,
    List<TestRunPromptResponse> Responses,
    DateTime CreatedAt
);

public record TestRunPromptResponse(
    int PromptIndex,
    string Content
);

public record TestStreamChunk(
    int PromptIndex,
    string Text
);

public record TestStreamResult(
    Guid RunId,
    List<TestRunPromptResponse> Responses
);
