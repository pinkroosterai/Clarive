using Clarive.Domain.ValueObjects;

namespace Clarive.Application.Entries.Contracts;

public record VersionInfo(
    int Version,
    string VersionState,
    DateTime? PublishedAt,
    string? PublishedBy,
    VersionEvaluationInfo? Evaluation = null,
    double? EvaluationAverageScore = null,
    DateTime? EvaluatedAt = null
);

public record VersionEvaluationInfo(Dictionary<string, PromptEvaluationEntry> Dimensions);
