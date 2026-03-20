using System.ComponentModel;

namespace Clarive.Domain.ValueObjects;

/// <summary>
/// A single dimension's evaluation score and feedback.
/// Persisted in IterationScore.Scores (jsonb) via AiSession.ScoreHistory.
/// </summary>
public class PromptEvaluationEntry
{
    [Description("Score from 0 to 10")]
    public int Score { get; set; }

    [Description("Explanation of the score and what would improve it")]
    public string Feedback { get; set; } = "";
}
