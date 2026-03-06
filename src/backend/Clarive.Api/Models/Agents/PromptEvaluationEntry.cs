using System.ComponentModel;

namespace Clarive.Api.Models.Agents;

/// <summary>
/// A single dimension's evaluation score and feedback.
/// </summary>
public class PromptEvaluationEntry
{
    [Description("Score from 0 to 10")]
    public int Score { get; set; }

    [Description("Explanation of the score and what would improve it")]
    public string Feedback { get; set; } = "";
}
