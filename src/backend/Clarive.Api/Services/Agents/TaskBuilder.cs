using System.Text.RegularExpressions;
using Clarive.Api.Models.Agents;

namespace Clarive.Api.Services.Agents;

/// <summary>
/// Builds structured task prompts for each agent role.
/// All methods are pure functions — no state, no side effects.
/// </summary>
public static class TaskBuilder
{
    public static string BuildPreGenerationClarificationTask(GenerationConfig config)
    {
        var configContext = new List<string>();
        if (config.GenerateSystemMessage)
            configContext.Add("System message generation is enabled.");
        if (config.GenerateAsPromptTemplate)
            configContext.Add("Template mode is enabled (placeholders will be used).");
        if (config.GenerateAsPromptChain)
            configContext.Add("Chain mode is enabled (multi-step prompt sequence).");
        if (config.SelectedTools.Count > 0)
        {
            var toolNames = string.Join(", ", config.SelectedTools.Select(t => t.Name));
            configContext.Add($"Tools available: {toolNames}.");
        }

        var configSection = configContext.Count > 0
            ? string.Join("\n", configContext.Select(c => $"- {c}"))
            : "- No special configuration.";

        return $"""
            Analyze the following prompt generation request and identify ambiguities
            that should be resolved before generating the prompt.

            User's request: {config.Description}

            Configuration already decided by the user:
            {configSection}

            Identify ambiguities in the user's intent and propose enhancements.
            """;
    }

    public static string BuildGenerationTask(
        GenerationConfig config,
        List<AnsweredQuestion>? preGenAnswers = null,
        List<string>? selectedEnhancements = null)
    {
        var requirements = new List<string>();

        if (config.GenerateSystemMessage)
            requirements.Add("Place the system message in the SystemMessage field of the response.");

        if (config.GenerateAsPromptTemplate)
            requirements.Add("""
                Use the following template tag syntax for placeholders:
                  {{name}}               — string input (default type)
                  {{name|type}}          — typed input
                  {{name|type:options}}  — typed input with constraints
                Supported types: string, int (with min-max range), float (with min-max range), enum (fixed set).
                Names may contain letters, digits, and underscores only.
                Choose the most specific type for each placeholder.
                """);

        if (config.GenerateAsPromptChain)
            requirements.Add("Structure as a multi-step prompt chain (3–5 steps).");

        if (config.SelectedTools.Count > 0)
        {
            var toolLines = string.Join("\n", config.SelectedTools.Select(t =>
                $"  - {t.Name}: {t.Description}"));
            requirements.Add($"""
                The following tools are available to the LLM executing the prompt:
                {toolLines}
                """);
        }

        var requirementsList = requirements.Count > 0
            ? string.Join("\n", requirements.Select(r => $"- {r}"))
            : "- No special requirements";

        var clarificationSection = "";
        if (preGenAnswers is { Count: > 0 })
        {
            var answerLines = string.Join("\n",
                preGenAnswers.Select(a => $"- Q: {a.Question}\n  A: {a.Answer}"));
            clarificationSection = $"""

                The user provided the following clarifications about their intent:
                {answerLines}
                Incorporate these decisions into the generated prompt.

                """;
        }

        var enhancementSection = "";
        if (selectedEnhancements is { Count: > 0 })
        {
            var enhancementLines = string.Join("\n",
                selectedEnhancements.Select(e => $"- {e}"));
            enhancementSection = $"""

                The user selected the following enhancements to incorporate:
                {enhancementLines}

                """;
        }

        return $"""
            Generate a high-quality prompt for the following use case.

            Purpose: {config.Description}
            {clarificationSection}{enhancementSection}
            Requirements:
            {requirementsList}

            Return a list of one or more prompts.
            """;
    }

    public static string BuildEvaluationTask(GenerationConfig config, PromptSet prompts)
    {
        var promptsText = FormatPromptsAsText(prompts);

        return $"""
            Evaluate the following generated prompt set.

            Original purpose: {config.Description}

            Generated prompts:
            {promptsText}
            """;
    }

    public static string BuildClarificationTask(GenerationConfig config, PromptSet prompts)
    {
        var promptsText = FormatPromptsAsText(prompts);

        var placeholderSection = "";
        if (config.GenerateAsPromptTemplate)
        {
            var placeholders = Regex.Matches(promptsText, @"\{\{([^}]+)\}\}")
                .Select(m => m.Groups[1].Value)
                .Distinct()
                .ToList();

            if (placeholders.Count > 0)
            {
                var list = string.Join("\n", placeholders.Select(p => $"  - {{{{{p}}}}}"));
                placeholderSection = $"""

                    The prompts are templates. The following placeholders are already parameterized
                    and will be replaced with user-supplied values before use:
                    {list}
                    Do not treat these as ambiguities. Focus on decisions that are NOT yet parameterized.

                    """;
            }
        }

        return $"""
            Analyze the following generated prompts against the user's original request.

            Original purpose: {config.Description}
            {placeholderSection}
            Generated prompts:
            {promptsText}

            Identify ambiguities in the user's intent and propose enhancements.
            """;
    }

    public static string BuildRevisionTask(
        GenerationConfig config,
        PromptEvaluation evaluation,
        List<AnsweredQuestion> answers,
        List<string> selectedEnhancements,
        List<double>? scoreHistory = null)
    {
        var scoresSummary = string.Join("\n", evaluation.PromptEvaluations
            .Select(e => $"- {e.Key}: {e.Value.Score}/10 — {e.Value.Feedback}"));

        var answersSummary = answers.Count > 0
            ? string.Join("\n", answers.Select(a => $"- Q: {a.Question}\n  A: {a.Answer}"))
            : "- No clarifications provided.";

        var enhancementsSummary = selectedEnhancements.Count > 0
            ? string.Join("\n", selectedEnhancements.Select(e => $"- {e}"))
            : "- No enhancements selected.";

        var historySection = "";
        if (scoreHistory is { Count: > 1 })
        {
            var historyLine = string.Join(" -> ", scoreHistory.Select(s => $"{s:F1}"));
            var trend = scoreHistory[^1] - scoreHistory[^2];
            var trendLabel = trend switch
            {
                > 0 => $"improving (+{trend:F1})",
                < 0 => $"declining ({trend:F1})",
                _ => "flat"
            };
            historySection = $"""

                Score trend across iterations: {historyLine} — {trendLabel}
                Focus revision effort on dimensions with the lowest scores.

                """;
        }

        return $"""
            Revise the prompts you generated based on the following feedback.

            Original purpose: {config.Description}
            {historySection}
            Evaluation scores and feedback:
            {scoresSummary}

            User clarifications:
            {answersSummary}

            Enhancements to incorporate:
            {enhancementsSummary}

            Return the complete revised prompt set. Preserve what works, address what was flagged.
            """;
    }

    public static string BuildSystemMessageTask(List<Models.Requests.PromptInput> prompts)
    {
        var content = string.Join("\n", prompts.Select(p => p.Content));
        return $"Generate a system message for these prompts:\n\n{content}";
    }

    public static string BuildDecompositionTask(
        string promptContent, bool isTemplate, string? systemMessage)
    {
        var parts = new List<string>
        {
            $"Decompose this {(isTemplate ? "template " : "")}prompt into a sequential chain of 3-5 steps:\n\n{promptContent}"
        };

        if (isTemplate)
            parts.Add("Place ALL template variables in the first step only. Preserve all {{name|type}} syntax exactly.");

        if (systemMessage is not null)
            parts.Add($"Context from system message:\n{systemMessage}");

        return string.Join("\n\n", parts);
    }

    public static string BuildEnhanceBootstrapTask(
        string? systemMessage, List<Models.Requests.PromptInput> prompts)
    {
        var parts = new List<string>();

        if (systemMessage is not null)
            parts.Add($"Current system message:\n{systemMessage}");

        parts.Add("Existing prompts to enhance:");
        for (var i = 0; i < prompts.Count; i++)
        {
            var p = prompts[i];
            parts.Add($"  [{i + 1}] {(p.IsTemplate ? "(template) " : "")}{p.Content}");
        }

        return string.Join("\n", parts);
    }

    public static string FormatPromptsAsText(PromptSet prompts)
    {
        var sections = new List<string>();

        if (!string.IsNullOrWhiteSpace(prompts.SystemMessage))
            sections.Add($"[System Message]\n{prompts.SystemMessage}");

        var stepNumber = 0;
        foreach (var p in prompts.Prompts)
        {
            stepNumber++;
            var label = p.IsTemplate ? $"[Step {stepNumber} - Template]" : $"[Step {stepNumber}]";
            sections.Add($"{label}\n{p.Content}");
        }

        return string.Join("\n\n", sections);
    }
}
