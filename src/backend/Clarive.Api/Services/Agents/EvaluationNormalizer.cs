using Clarive.Api.Models.Agents;

namespace Clarive.Api.Services.Agents;

/// <summary>
/// Normalizes LLM-returned evaluation dimension names to match expected dimensions.
/// Handles casing differences, partial matches, and near-misspellings via Levenshtein distance.
/// </summary>
public static class EvaluationNormalizer
{
    public static readonly string[] ExpectedDimensions =
        ["Clarity", "Effectiveness", "Completeness", "Faithfulness"];

    public static double ComputeAverageScore(PromptEvaluation evaluation)
    {
        var entries = evaluation.PromptEvaluations.Values;
        return entries.Count > 0 ? entries.Average(e => e.Score) : 0;
    }

    public static PromptEvaluation Normalize(PromptEvaluation raw)
    {
        var normalized = new Dictionary<string, PromptEvaluationEntry>();
        var consumed = new HashSet<string>(StringComparer.OrdinalIgnoreCase);

        foreach (var expected in ExpectedDimensions)
        {
            var match = FindBestMatch(expected, raw.PromptEvaluations, consumed);
            if (match is not null)
            {
                normalized[expected] = match.Value.Entry;
                consumed.Add(match.Value.Key);
            }
            else
            {
                normalized[expected] = new PromptEvaluationEntry
                {
                    Score = 0,
                    Feedback = "Not evaluated — dimension was missing from the evaluation response."
                };
            }
        }

        return new PromptEvaluation { PromptEvaluations = normalized };
    }

    private static (string Key, PromptEvaluationEntry Entry)? FindBestMatch(
        string expected,
        Dictionary<string, PromptEvaluationEntry> candidates,
        HashSet<string> consumed)
    {
        // Pass 1: exact case-insensitive match
        foreach (var kvp in candidates)
        {
            if (consumed.Contains(kvp.Key))
                continue;
            if (string.Equals(kvp.Key, expected, StringComparison.OrdinalIgnoreCase))
                return (kvp.Key, kvp.Value);
        }

        // Pass 2: substring/contains match (e.g., "prompt_clarity" → "Clarity")
        foreach (var kvp in candidates)
        {
            if (consumed.Contains(kvp.Key))
                continue;
            if (kvp.Key.Contains(expected, StringComparison.OrdinalIgnoreCase) ||
                expected.Contains(kvp.Key, StringComparison.OrdinalIgnoreCase))
                return (kvp.Key, kvp.Value);
        }

        // Pass 3: Levenshtein distance ≤ 3 (catches typos like "Specifity", "Claritiy")
        const int maxDistance = 3;
        string? bestKey = null;
        PromptEvaluationEntry? bestEntry = null;
        var bestDistance = maxDistance + 1;

        foreach (var kvp in candidates)
        {
            if (consumed.Contains(kvp.Key))
                continue;
            var distance = LevenshteinDistance(expected.ToLowerInvariant(), kvp.Key.ToLowerInvariant());
            if (distance < bestDistance)
            {
                bestDistance = distance;
                bestKey = kvp.Key;
                bestEntry = kvp.Value;
            }
        }

        return bestKey is not null ? (bestKey, bestEntry!) : null;
    }

    private static int LevenshteinDistance(string a, string b)
    {
        if (a.Length == 0) return b.Length;
        if (b.Length == 0) return a.Length;

        var matrix = new int[a.Length + 1, b.Length + 1];

        for (var i = 0; i <= a.Length; i++) matrix[i, 0] = i;
        for (var j = 0; j <= b.Length; j++) matrix[0, j] = j;

        for (var i = 1; i <= a.Length; i++)
        {
            for (var j = 1; j <= b.Length; j++)
            {
                var cost = a[i - 1] == b[j - 1] ? 0 : 1;
                matrix[i, j] = Math.Min(
                    Math.Min(matrix[i - 1, j] + 1, matrix[i, j - 1] + 1),
                    matrix[i - 1, j - 1] + cost);
            }
        }

        return matrix[a.Length, b.Length];
    }
}
