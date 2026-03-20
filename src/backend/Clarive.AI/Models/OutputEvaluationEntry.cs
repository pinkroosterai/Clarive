using System.ComponentModel;

namespace Clarive.AI.Models;

/// <summary>
/// A single dimension's output evaluation score and feedback from the LLM judge.
/// </summary>
public class OutputEvaluationEntry
{
    [Description("Score from 0 to 10")]
    public int Score { get; set; }

    [Description("Explanation of the score and what would improve it")]
    public string Feedback { get; set; } = "";
}
