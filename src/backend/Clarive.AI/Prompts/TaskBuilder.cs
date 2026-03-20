using Clarive.AI.Configuration;
using System.Text.RegularExpressions;
using Clarive.AI.Models;
using Clarive.Domain.ValueObjects;

namespace Clarive.AI.Prompts;

/// <summary>
/// Builds structured task prompts for each agent role.
/// All methods are pure functions — no state, no side effects.
/// </summary>
public static class TaskBuilder
{
    public static string BuildGenerationTask(GenerationConfig config)
    {
        var requirements = new List<string>();

        if (config.GenerateSystemMessage)
            requirements.Add(
                "Place the system message in the SystemMessage field of the response."
            );

        if (config.GenerateAsPromptTemplate)
            requirements.Add(
                """
                Use the following template tag syntax for placeholders:
                  {{name}}               — string input (default type)
                  {{name|type}}          — typed input
                  {{name|type:options}}  — typed input with constraints
                Supported types: string, int (with min-max range), float (with min-max range), enum (fixed set).
                Names may contain letters, digits, and underscores only.
                Choose the most specific type for each placeholder.
                """
            );

        if (config.GenerateAsPromptChain)
            requirements.Add("Structure as a multi-step prompt chain (3–5 steps).");

        if (config.SelectedTools.Count > 0)
        {
            var toolLines = string.Join(
                "\n",
                config.SelectedTools.Select(t => $"  - {t.Name}: {t.Description}")
            );
            requirements.Add(
                $"""
                The following tools are available to the LLM executing the prompt:
                {toolLines}
                """
            );
        }

        var requirementsList =
            requirements.Count > 0
                ? string.Join("\n", requirements.Select(r => $"- {r}"))
                : "- No special requirements";

        return $"""
            Generate a high-quality prompt for the following use case.

            Purpose: {config.Description}

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
            var placeholders = Regex
                .Matches(promptsText, @"\{\{([^}]+)\}\}")
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
        List<double>? scoreHistory = null
    )
    {
        var scoresSummary = string.Join(
            "\n",
            evaluation.PromptEvaluations.Select(e =>
                $"- {e.Key}: {e.Value.Score}/10 — {e.Value.Feedback}"
            )
        );

        var answersSummary =
            answers.Count > 0
                ? string.Join("\n", answers.Select(a => $"- Q: {a.Question}\n  A: {a.Answer}"))
                : "- No clarifications provided.";

        var enhancementsSummary =
            selectedEnhancements.Count > 0
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
                _ => "flat",
            };
            historySection = $"""

                Score trend across iterations: {historyLine} — {trendLabel}
                Focus revision effort on dimensions with the lowest scores.

                """;
        }

        var toolSection = "";
        if (config.SelectedTools.Count > 0)
        {
            var toolLines = string.Join(
                "\n",
                config.SelectedTools.Select(t => $"  - {t.Name}: {t.Description}")
            );
            toolSection = $"""

                Available tools (ensure the revised prompts still integrate these):
                {toolLines}

                """;
        }

        return $"""
            Revise the prompts you generated based on the following feedback.

            Original purpose: {config.Description}
            {toolSection}{historySection}
            Evaluation scores and feedback:
            {scoresSummary}

            User clarifications:
            {answersSummary}

            Enhancements to incorporate:
            {enhancementsSummary}

            Return the complete revised prompt set. Preserve what works, address what was flagged.
            """;
    }

    public static string BuildSystemMessageTask(List<PromptInput> prompts)
    {
        var content = string.Join("\n", prompts.Select(p => p.Content));
        return $"Generate a system message for these prompts:\n\n{content}";
    }

    public static string BuildDecompositionTask(
        string promptContent,
        bool isTemplate,
        string? systemMessage
    )
    {
        var parts = new List<string>
        {
            $"Decompose this {(isTemplate ? "template " : "")}prompt into a sequential chain of 3-5 steps:\n\n{promptContent}",
        };

        if (isTemplate)
            parts.Add(
                "Place ALL template variables in the first step only. Preserve all {{name|type}} syntax exactly."
            );

        if (systemMessage is not null)
            parts.Add($"Context from system message:\n{systemMessage}");

        return string.Join("\n\n", parts);
    }

    public static string BuildEnhanceBootstrapTask(
        string? systemMessage,
        List<PromptInput> prompts
    )
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

    public static string BuildPlaygroundJudgeTask(
        string? systemMessage,
        List<PromptInput> prompts,
        List<TestRunPromptResponse> responses,
        string modelName
    )
    {
        var sections = new List<string>();

        if (!string.IsNullOrWhiteSpace(systemMessage))
            sections.Add($"[System Message]\n{systemMessage}");

        for (var i = 0; i < prompts.Count; i++)
        {
            var prompt = prompts[i];
            var label = prompt.IsTemplate ? $"[Prompt {i + 1} - Template]" : $"[Prompt {i + 1}]";
            sections.Add($"{label}\n{prompt.Content}");
        }

        var promptsText = string.Join("\n\n", sections);

        var responseSections = responses
            .OrderBy(r => r.PromptIndex)
            .Select(r => $"[Response {r.PromptIndex + 1}]\n{r.Content}");
        var responsesText = string.Join("\n\n", responseSections);

        return $"""
            Evaluate the quality of the following LLM output.

            Original prompt(s):
            {promptsText}

            Model response ({modelName}):
            {responsesText}

            Judge the response quality across all dimensions.
            """;
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

    public static string BuildFillTemplateFieldsTask(
        List<PromptInput> prompts,
        string? systemMessage,
        List<TemplateFieldInfo> fields
    )
    {
        var parts = new List<string>
        {
            "Generate realistic example values for the following template fields.",
        };

        if (systemMessage is not null)
            parts.Add($"System message context:\n{systemMessage}");

        parts.Add("Prompt content:");
        for (var i = 0; i < prompts.Count; i++)
            parts.Add($"  [{i + 1}] {prompts[i].Content}");

        parts.Add("Template fields:");
        foreach (var f in fields)
        {
            var desc = $"  - {f.Name} (type: {f.Type})";
            if (f.EnumValues is { Count: > 0 })
                desc += $" — allowed values: {string.Join(", ", f.EnumValues)}";
            if (f.Min.HasValue || f.Max.HasValue)
                desc += $" — range: {f.Min?.ToString() ?? "any"}–{f.Max?.ToString() ?? "any"}";
            if (f.Description is not null)
                desc += $" — {f.Description}";
            parts.Add(desc);
        }

        return string.Join("\n\n", parts);
    }
}

/// <summary>
/// Lightweight DTO for passing template field metadata to the orchestrator
/// without depending on EF entities.
/// </summary>
public record TemplateFieldInfo(
    string Name,
    string Type,
    List<string>? EnumValues = null,
    double? Min = null,
    double? Max = null,
    string? Description = null
);
