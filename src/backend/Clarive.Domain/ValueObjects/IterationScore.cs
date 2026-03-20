namespace Clarive.Domain.ValueObjects;

/// <summary>
/// Score snapshot for a single generation/refinement iteration.
/// Persisted in AiSession.ScoreHistory (jsonb).
/// </summary>
public record IterationScore
{
    public int Iteration { get; init; }
    public Dictionary<string, PromptEvaluationEntry> Scores { get; init; } = new();
    public double AverageScore { get; init; }
}
