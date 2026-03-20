using Clarive.AI.Services;
using Clarive.AI.Models;
using Clarive.Domain.ValueObjects;

namespace Clarive.AI.Agents;

/// <summary>
/// Normalizes LLM-returned output evaluation dimension names to match expected dimensions.
/// Delegates matching logic to <see cref="DimensionNormalizer"/>.
/// </summary>
public static class OutputEvaluationNormalizer
{
    public static readonly string[] ExpectedDimensions =
    [
        "Accuracy",
        "Helpfulness",
        "Relevance",
        "Coherence",
        "Safety",
    ];

    public static OutputEvaluation Normalize(OutputEvaluation raw)
    {
        var normalized = DimensionNormalizer.Normalize(
            raw.Dimensions,
            ExpectedDimensions,
            () =>
                new OutputEvaluationEntry
                {
                    Score = 0,
                    Feedback =
                        "Not evaluated — dimension was missing from the evaluation response.",
                }
        );

        return new OutputEvaluation { Dimensions = normalized };
    }
}
