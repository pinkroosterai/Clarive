using Clarive.AI.Models;
using Clarive.Domain.ValueObjects;

namespace Clarive.Application.Playground.Contracts;

public record TestRunResponse(
    Guid Id,
    string Model,
    float Temperature,
    int MaxTokens,
    Dictionary<string, string>? TemplateFieldValues,
    List<ConversationMessage> ConversationLog,
    long? InputTokens,
    long? OutputTokens,
    DateTime CreatedAt,
    OutputEvaluation? JudgeScores = null,
    int? VersionNumber = null,
    string? VersionLabel = null
);

public record TestStreamChunk(int PromptIndex, string Text, string Type = "text");

public record TestStreamResult(
    Guid RunId,
    List<ConversationMessage> ConversationLog,
    long? InputTokens,
    long? OutputTokens,
    OutputEvaluation? JudgeScores = null,
    int? VersionNumber = null,
    string? VersionLabel = null
);
