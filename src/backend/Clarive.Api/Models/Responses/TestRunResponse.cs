using Clarive.Api.Models.Agents;

namespace Clarive.Api.Models.Responses;

public record TestRunResponse(
    Guid Id,
    string Model,
    float Temperature,
    int MaxTokens,
    Dictionary<string, string>? TemplateFieldValues,
    List<TestRunPromptResponse> Responses,
    long? InputTokens,
    long? OutputTokens,
    DateTime CreatedAt,
    OutputEvaluation? JudgeScores = null
);

public record TestRunPromptResponse(
    int PromptIndex,
    string Content
);

public record TestStreamChunk(
    int PromptIndex,
    string Text,
    string Type = "text"
);

public record TestStreamResult(
    Guid RunId,
    List<TestRunPromptResponse> Responses,
    long? InputTokens,
    long? OutputTokens,
    string? Reasoning,
    OutputEvaluation? JudgeScores = null
);
