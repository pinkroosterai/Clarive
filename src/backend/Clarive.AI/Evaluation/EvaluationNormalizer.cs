using Clarive.AI.Configuration;
using Clarive.AI.Models;
using Clarive.Domain.ValueObjects;

namespace Clarive.AI.Evaluation;

/// <summary>
/// Normalizes LLM-returned prompt evaluation dimension names to match expected dimensions.
/// Delegates matching logic to <see cref="DimensionNormalizer"/>.
/// </summary>
public static class EvaluationNormalizer
{
    public static readonly string[] ExpectedDimensions =
    [
        "Clarity",
        "Effectiveness",
        "Completeness",
        "Faithfulness",
    ];

    public static double ComputeAverageScore(PromptEvaluation evaluation)
    {
        var entries = evaluation.PromptEvaluations.Values;
        return entries.Count > 0 ? entries.Average(e => e.Score) : 0;
    }

    /// <summary>
    /// Maps the fixed-property wire shape back onto the dictionary the rest of the app stores
    /// and serves. A null property counts as a missing dimension and gets the default entry.
    /// </summary>
    public static PromptEvaluation Normalize(PromptEvaluationResponse raw)
    {
        var entries = new Dictionary<string, PromptEvaluationEntry>();
        Add(entries, "Clarity", raw.Clarity);
        Add(entries, "Effectiveness", raw.Effectiveness);
        Add(entries, "Completeness", raw.Completeness);
        Add(entries, "Faithfulness", raw.Faithfulness);
        return Normalize(new PromptEvaluation { PromptEvaluations = entries });
    }

    private static void Add(
        Dictionary<string, PromptEvaluationEntry> entries,
        string dimension,
        PromptEvaluationEntry? entry
    )
    {
        if (entry is not null)
            entries[dimension] = entry;
    }

    public static PromptEvaluation Normalize(PromptEvaluation raw)
    {
        var normalized = DimensionNormalizer.Normalize(
            raw.PromptEvaluations,
            ExpectedDimensions,
            () =>
                new PromptEvaluationEntry
                {
                    Score = 0,
                    Feedback =
                        "Not evaluated — dimension was missing from the evaluation response.",
                }
        );

        return new PromptEvaluation { PromptEvaluations = normalized };
    }
}
