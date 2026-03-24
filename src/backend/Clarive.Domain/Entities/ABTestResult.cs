using System.Text.Json.Serialization;
using Clarive.Domain.ValueObjects;

namespace Clarive.Domain.Entities;

public class ABTestResult
{
    public Guid Id { get; set; }
    public Guid RunId { get; set; }
    public Guid DatasetRowId { get; set; }
    public string? VersionAOutput { get; set; }
    public string? VersionBOutput { get; set; }
    public Dictionary<string, OutputEvaluationEntry>? VersionAScores { get; set; }
    public Dictionary<string, OutputEvaluationEntry>? VersionBScores { get; set; }
    public double? VersionAAvgScore { get; set; }
    public double? VersionBAvgScore { get; set; }

    // Navigation
    [JsonIgnore]
    public ABTestRun Run { get; set; } = null!;
}
