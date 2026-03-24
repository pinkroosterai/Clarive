using Clarive.Domain.ValueObjects;

namespace Clarive.Application.Entries.Contracts;

public record VersionInfo(
    Guid Id,
    int Version,
    string VersionState,
    DateTime? PublishedAt,
    string? PublishedBy,
    string? TabName = null,
    int? ForkedFromVersion = null,
    bool IsMainTab = false,
    VersionEvaluationInfo? Evaluation = null,
    double? EvaluationAverageScore = null,
    DateTime? EvaluatedAt = null
);

public record VersionEvaluationInfo(Dictionary<string, PromptEvaluationEntry> Dimensions);
