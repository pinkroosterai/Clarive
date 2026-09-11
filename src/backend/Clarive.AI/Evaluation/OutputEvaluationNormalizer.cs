using Clarive.AI.Configuration;
using Clarive.AI.Models;
using Clarive.Domain.ValueObjects;

namespace Clarive.AI.Evaluation;

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

    /// <summary>
    /// Maps the fixed-property wire shape back onto the dictionary the rest of the app stores
    /// and serves. A null property counts as a missing dimension and gets the default entry.
    /// </summary>
    public static OutputEvaluation Normalize(OutputEvaluationResponse raw)
    {
        var entries = new Dictionary<string, OutputEvaluationEntry>();
        Add(entries, "Accuracy", raw.Accuracy);
        Add(entries, "Helpfulness", raw.Helpfulness);
        Add(entries, "Relevance", raw.Relevance);
        Add(entries, "Coherence", raw.Coherence);
        Add(entries, "Safety", raw.Safety);
        return Normalize(new OutputEvaluation { Dimensions = entries });
    }

    private static void Add(
        Dictionary<string, OutputEvaluationEntry> entries,
        string dimension,
        OutputEvaluationEntry? entry
    )
    {
        if (entry is not null)
            entries[dimension] = entry;
    }

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
