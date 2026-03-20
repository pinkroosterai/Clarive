namespace Clarive.Core.Services;

public static class ReasoningModelDetector
{
    private static readonly string[] ReasoningPrefixes =
    [
        "o1",
        "o3",
        "o4-mini",
        "deepseek-reasoner",
        "qwq",
    ];

    /// <summary>
    /// Determines whether a model ID corresponds to a known reasoning model
    /// by matching against known prefixes (case-insensitive).
    /// Handles versioned suffixes like "o3-mini-2025-01-31".
    /// </summary>
    public static bool IsReasoningModel(string modelId)
    {
        if (string.IsNullOrWhiteSpace(modelId))
            return false;

        foreach (var prefix in ReasoningPrefixes)
        {
            // Exact match or next char is '-' (to avoid "o1" matching "o10-something")
            if (
                modelId.StartsWith(prefix, StringComparison.OrdinalIgnoreCase)
                && (modelId.Length == prefix.Length || modelId[prefix.Length] == '-')
            )
                return true;
        }

        return false;
    }
}
