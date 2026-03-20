using Clarive.AI.Models;
using Clarive.Domain.ValueObjects;

namespace Clarive.Application.AiGeneration;

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
    OutputEvaluation? JudgeScores = null,
    List<TestRunPromptResponse>? Reasoning = null,
    string? RenderedSystemMessage = null,
    List<TestRunPromptResponse>? RenderedPrompts = null,
    int? VersionNumber = null,
    string? VersionLabel = null
);

public record TestStreamChunk(int PromptIndex, string Text, string Type = "text");

public record TestStreamResult(
    Guid RunId,
    List<TestRunPromptResponse> Responses,
    long? InputTokens,
    long? OutputTokens,
    string? Reasoning,
    OutputEvaluation? JudgeScores = null,
    int? VersionNumber = null,
    string? VersionLabel = null
);
