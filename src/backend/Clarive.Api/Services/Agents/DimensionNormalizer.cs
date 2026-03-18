namespace Clarive.Api.Services.Agents;

/// <summary>
/// Generic dimension normalization for LLM-returned evaluation results.
/// Handles casing differences, partial matches, and near-misspellings via Levenshtein distance.
/// Used by both EvaluationNormalizer and OutputEvaluationNormalizer.
/// </summary>
public static class DimensionNormalizer
{
    /// <summary>
    /// Normalizes LLM-returned dimension names to match expected dimensions via 3-pass matching.
    /// Missing dimensions are filled with a default entry.
    /// </summary>
    public static Dictionary<string, TEntry> Normalize<TEntry>(
        Dictionary<string, TEntry> raw,
        string[] expectedDimensions,
        Func<TEntry> createDefault)
        where TEntry : class
    {
        var normalized = new Dictionary<string, TEntry>();
        var consumed = new HashSet<string>(StringComparer.OrdinalIgnoreCase);

        foreach (var expected in expectedDimensions)
        {
            var match = FindBestMatch(expected, raw, consumed);
            if (match is not null)
            {
                normalized[expected] = match.Value.Entry;
                consumed.Add(match.Value.Key);
            }
            else
            {
                normalized[expected] = createDefault();
            }
        }

        return normalized;
    }

    private static (string Key, TEntry Entry)? FindBestMatch<TEntry>(
        string expected,
        Dictionary<string, TEntry> candidates,
        HashSet<string> consumed)
        where TEntry : class
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

        // Pass 3: Levenshtein distance ≤ 3 (catches typos like "Claritiy", "Accurcy")
        const int maxDistance = 3;
        string? bestKey = null;
        TEntry? bestEntry = null;
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

    internal static int LevenshteinDistance(string a, string b)
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
