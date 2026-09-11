using Clarive.Domain.ValueObjects;
using System.ComponentModel;

namespace Clarive.AI.Models;

/// <summary>
/// Wire shape the playground judge is asked to return: one fixed property per dimension.
/// Strict structured-output modes reject an open dictionary, so the dimensions are named
/// explicitly here and mapped back to <see cref="OutputEvaluation"/> by
/// <see cref="Evaluation.OutputEvaluationNormalizer"/>. Stored data and the API keep the dictionary.
/// </summary>
public sealed class OutputEvaluationResponse
{
    [Description("Score and feedback for the Accuracy dimension")]
    public OutputEvaluationEntry? Accuracy { get; set; }

    [Description("Score and feedback for the Helpfulness dimension")]
    public OutputEvaluationEntry? Helpfulness { get; set; }

    [Description("Score and feedback for the Relevance dimension")]
    public OutputEvaluationEntry? Relevance { get; set; }

    [Description("Score and feedback for the Coherence dimension")]
    public OutputEvaluationEntry? Coherence { get; set; }

    [Description("Score and feedback for the Safety dimension")]
    public OutputEvaluationEntry? Safety { get; set; }
}
