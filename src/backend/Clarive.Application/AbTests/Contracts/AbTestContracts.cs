using System.ComponentModel.DataAnnotations;
using Clarive.Domain.ValueObjects;

namespace Clarive.Application.AbTests.Contracts;

// ── Requests ──

public record StartAbTestRequest(
    [property: Required(ErrorMessage = "Version A is required.")]
    [property: Range(1, int.MaxValue, ErrorMessage = "Version A must be a positive integer.")]
        int VersionANumber,
    [property: Required(ErrorMessage = "Version B is required.")]
    [property: Range(1, int.MaxValue, ErrorMessage = "Version B must be a positive integer.")]
        int VersionBNumber,
    [property: Required(ErrorMessage = "Dataset ID is required.")]
        Guid DatasetId,
    [property: Required(ErrorMessage = "Model is required.")]
    [property: StringLength(100, MinimumLength = 1)]
        string Model,
    [property: Range(0.0, 2.0, ErrorMessage = "Temperature must be between 0 and 2.")]
        float Temperature = 1.0f,
    [property: Range(1, int.MaxValue, ErrorMessage = "Max tokens must be positive.")]
        int MaxTokens = 4096,
    [property: StringLength(20)]
        string? ReasoningEffort = null
);

// ── Responses ──

public record AbTestRunResponse(
    Guid Id,
    int VersionA,
    int VersionB,
    string? DatasetName,
    string Model,
    string Status,
    int ResultCount,
    DateTime CreatedAt,
    DateTime? CompletedAt
);

public record AbTestRunDetailResponse(
    Guid Id,
    int VersionA,
    int VersionB,
    string? DatasetName,
    string Model,
    string Status,
    int ResultCount,
    DateTime CreatedAt,
    DateTime? CompletedAt,
    List<AbTestResultResponse> Results,
    AggregateSummary? Summary
);

public record AbTestResultResponse(
    Guid Id,
    Guid DatasetRowId,
    Dictionary<string, string>? InputValues,
    string? VersionAOutput,
    string? VersionBOutput,
    Dictionary<string, OutputEvaluationEntry>? VersionAScores,
    Dictionary<string, OutputEvaluationEntry>? VersionBScores,
    double? VersionAAvgScore,
    double? VersionBAvgScore
);

public record AggregateSummary(
    double VersionAAvg,
    double VersionBAvg,
    double DeltaPercent,
    int VersionAWins,
    int VersionBWins,
    int Ties,
    Dictionary<string, DimensionComparison> PerDimension
);

public record DimensionComparison(
    double VersionAAvg,
    double VersionBAvg,
    double Delta
);

// ── Progress Events ──

public record AbTestProgressEvent(
    string Type,
    int CurrentRow,
    int TotalRows,
    string? VersionLabel = null,
    string? Message = null
);
