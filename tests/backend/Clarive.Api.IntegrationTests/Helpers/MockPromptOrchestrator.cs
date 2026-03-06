using Clarive.Api.Models.Agents;
using Clarive.Api.Models.Requests;
using Clarive.Api.Services.Agents;

namespace Clarive.Api.IntegrationTests.Helpers;

/// <summary>
/// Deterministic mock for IPromptOrchestrator. Returns predictable results
/// without calling OpenAI, enabling fast integration tests.
/// </summary>
internal class MockPromptOrchestrator : IPromptOrchestrator
{
    /// <summary>
    /// When set to true, GenerateAsync will throw an exception to simulate AI failure.
    /// Reset to false after the throw to avoid affecting other tests.
    /// </summary>
    public static bool ShouldThrowOnGenerate { get; set; }

    public bool IsConfigured => true;

    public Task<PreGenClarifyResult> PreGenClarifyAsync(
        GenerationConfig config, CancellationToken ct = default,
        Func<string, Task>? onProgress = null)
    {
        return Task.FromResult(new PreGenClarifyResult(
            AgentSessionId: "mock-session-" + Guid.NewGuid().ToString("N")[..8],
            Questions:
            [
                new ClarificationQuestion
                {
                    Text = "What is the intended audience?",
                    Suggestions = ["Technical users", "Non-technical users", "Mixed audience"]
                },
                new ClarificationQuestion
                {
                    Text = "What output format do you prefer?",
                    Suggestions = ["Markdown", "Plain text", "JSON"]
                },
                new ClarificationQuestion
                {
                    Text = "What level of detail is needed?",
                    Suggestions = ["High-level overview", "Detailed step-by-step", "Balanced"]
                }
            ],
            Enhancements:
            [
                "Add structured formatting with headers and bullet points",
                "Include concrete examples for key concepts",
                "Add error handling instructions"
            ]));
    }

    public Task<GenerateOrchestratorResult> GenerateAsync(
        string agentSessionId, GenerationConfig config,
        List<AnsweredQuestion>? preGenAnswers,
        List<string>? selectedEnhancements = null,
        CancellationToken ct = default,
        Func<string, Task>? onProgress = null)
    {
        if (ShouldThrowOnGenerate)
        {
            ShouldThrowOnGenerate = false;
            throw new InvalidOperationException("Simulated AI failure for testing credit refund");
        }

        var prompts = new PromptSet
        {
            Title = $"AI Generated: {config.Description}",
            SystemMessage = config.GenerateSystemMessage
                ? $"You are an expert assistant for: {config.Description}"
                : null,
            Prompts = config.GenerateAsPromptChain
                ? [
                    new PromptMessage { Content = $"Step 1: Analyze {config.Description}" },
                    new PromptMessage { Content = "Step 2: Plan the approach" },
                    new PromptMessage { Content = "Step 3: Execute and deliver" }
                ]
                : config.GenerateAsPromptTemplate
                    ? [new PromptMessage
                    {
                        Content = $"Write a {{{{tone|enum:formal,casual}}}} response about {{{{topic|string}}}} for: {config.Description}",
                        IsTemplate = true
                    }]
                    : [new PromptMessage { Content = $"Generated prompt for: {config.Description}" }]
        };

        var evaluation = new PromptEvaluation
        {
            PromptEvaluations = new Dictionary<string, PromptEvaluationEntry>
            {
                ["Clarity"] = new() { Score = 7, Feedback = "Clear instructions with minor ambiguities." },
                ["Specificity"] = new() { Score = 6, Feedback = "Could benefit from more concrete constraints." },
                ["Structure"] = new() { Score = 8, Feedback = "Well-organized with logical flow." },
                ["Completeness"] = new() { Score = 7, Feedback = "Covers main requirements." },
                ["Autonomy"] = new() { Score = 9, Feedback = "LLM can execute without user input." },
                ["Faithfulness"] = new() { Score = 8, Feedback = "Closely matches the stated purpose." }
            }
        };

        var clarification = new ClarificationResult
        {
            Questions =
            [
                new ClarificationQuestion
                {
                    Text = $"What aspects of '{config.Description}' matter most?",
                    Suggestions = ["Accuracy", "Creativity", "Brevity"]
                },
                new ClarificationQuestion
                {
                    Text = "What level of detail is needed?",
                    Suggestions = ["Summary", "Detailed", "Comprehensive"]
                },
                new ClarificationQuestion
                {
                    Text = "Any formatting requirements?",
                    Suggestions = ["Markdown", "Plain text", "Structured JSON"]
                }
            ],
            Enhancements =
            [
                "Add structured formatting",
                "Include examples",
                "Add error handling"
            ]
        };

        return Task.FromResult(new GenerateOrchestratorResult(prompts, evaluation, clarification));
    }

    public Task<GenerateOrchestratorResult> RefineAsync(
        string agentSessionId, GenerationConfig config,
        PromptEvaluation currentEvaluation,
        List<AnsweredQuestion> answers, List<string> selectedEnhancements,
        List<double>? scoreHistory,
        CancellationToken ct = default,
        Func<string, Task>? onProgress = null)
    {
        var prompts = new PromptSet
        {
            Title = $"Refined: AI Generated: {config.Description}",
            SystemMessage = config.GenerateSystemMessage
                ? $"You are an expert assistant for: {config.Description}"
                : null,
            Prompts = [new PromptMessage { Content = $"Refined prompt for: {config.Description}" }]
        };

        var evaluation = new PromptEvaluation
        {
            PromptEvaluations = new Dictionary<string, PromptEvaluationEntry>
            {
                ["Clarity"] = new() { Score = 8, Feedback = "Improved clarity after refinement." },
                ["Specificity"] = new() { Score = 7, Feedback = "Better constraints added." },
                ["Structure"] = new() { Score = 8, Feedback = "Well-organized." },
                ["Completeness"] = new() { Score = 8, Feedback = "Addresses feedback." },
                ["Autonomy"] = new() { Score = 9, Feedback = "Fully autonomous." },
                ["Faithfulness"] = new() { Score = 9, Feedback = "Closely matches intent." }
            }
        };

        var clarification = new ClarificationResult
        {
            Questions =
            [
                new ClarificationQuestion
                {
                    Text = "Adjust the tone?",
                    Suggestions = ["More formal", "More casual", "Keep as-is"]
                },
                new ClarificationQuestion
                {
                    Text = "Add domain terminology?",
                    Suggestions = ["Yes", "No", "Minimal"]
                }
            ],
            Enhancements =
            [
                "Make it more concise",
                "Add role-playing context",
                "Add output format spec"
            ]
        };

        return Task.FromResult(new GenerateOrchestratorResult(prompts, evaluation, clarification));
    }

    public Task<EnhanceOrchestratorResult> EnhanceAsync(
        string? systemMessage, List<PromptInput> prompts,
        GenerationConfig config, CancellationToken ct = default,
        Func<string, Task>? onProgress = null)
    {
        var enhancedPrompts = new PromptSet
        {
            Title = "Enhanced Entry",
            SystemMessage = systemMessage,
            Prompts = prompts.Select(p => new PromptMessage
            {
                Content = $"Enhanced: {p.Content}",
                IsTemplate = p.IsTemplate
            }).ToList()
        };

        var evaluation = new PromptEvaluation
        {
            PromptEvaluations = new Dictionary<string, PromptEvaluationEntry>
            {
                ["Clarity"] = new() { Score = 6, Feedback = "Moderate clarity." },
                ["Specificity"] = new() { Score = 5, Feedback = "Needs more constraints." },
                ["Structure"] = new() { Score = 7, Feedback = "Reasonable structure." },
                ["Completeness"] = new() { Score = 4, Feedback = "Missing edge cases." },
                ["Autonomy"] = new() { Score = 8, Feedback = "Mostly autonomous." },
                ["Faithfulness"] = new() { Score = 7, Feedback = "Aligns with original intent." }
            }
        };

        var clarification = new ClarificationResult
        {
            Questions =
            [
                new ClarificationQuestion
                {
                    Text = "What improvements are you looking for?",
                    Suggestions = ["Clarity", "Completeness", "Structure"]
                },
                new ClarificationQuestion
                {
                    Text = "Is the tone appropriate?",
                    Suggestions = ["Yes", "Too formal", "Too casual"]
                }
            ],
            Enhancements =
            [
                "Improve clarity",
                "Add constraints",
                "Optimize for consistency"
            ]
        };

        return Task.FromResult(new EnhanceOrchestratorResult(
            "mock-enhance-session",
            enhancedPrompts, evaluation, clarification));
    }

    public Task<string> GenerateSystemMessageAsync(
        List<PromptInput> prompts, CancellationToken ct = default)
    {
        return Task.FromResult("You are a helpful AI assistant specialized in this domain.");
    }

    public Task<List<PromptInput>> DecomposeAsync(
        string promptContent, bool isTemplate = false, string? systemMessage = null,
        CancellationToken ct = default)
    {
        return Task.FromResult(new List<PromptInput>
        {
            new("Step 1: Understand the task"),
            new("Step 2: Research and plan"),
            new("Step 3: Execute and deliver")
        });
    }
}
