using Clarive.Domain.ValueObjects;
using System.ComponentModel;

namespace Clarive.AI.Models;

/// <summary>
/// Wire shape the evaluation agent is asked to return: one fixed property per dimension.
/// Strict structured-output modes reject an open dictionary (the key ends up in
/// <c>required</c> but not in <c>properties</c>), so the dimensions are named explicitly here
/// and mapped back to <see cref="PromptEvaluation"/> by
/// <see cref="Evaluation.EvaluationNormalizer"/>. Stored data and the API keep the dictionary.
/// </summary>
public sealed class PromptEvaluationResponse
{
    [Description("Score and feedback for the Clarity dimension")]
    public PromptEvaluationEntry? Clarity { get; set; }

    [Description("Score and feedback for the Effectiveness dimension")]
    public PromptEvaluationEntry? Effectiveness { get; set; }

    [Description("Score and feedback for the Completeness dimension")]
    public PromptEvaluationEntry? Completeness { get; set; }

    [Description("Score and feedback for the Faithfulness dimension")]
    public PromptEvaluationEntry? Faithfulness { get; set; }
}
