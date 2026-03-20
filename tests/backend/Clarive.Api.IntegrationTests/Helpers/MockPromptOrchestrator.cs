using Clarive.AI.Models;
using Clarive.AI.Pipeline;
using Clarive.AI.Orchestration;
using Clarive.AI.Configuration;
using Clarive.AI.Prompts;
using Clarive.Domain.ValueObjects;

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

    /// <summary>
    /// When set, GenerateAsync will throw an AiProviderException with this category.
    /// Reset to null after the throw to avoid affecting other tests.
    /// </summary>
    public static AiProviderErrorCategory? ThrowAiProviderErrorCategory { get; set; }

    public bool IsConfigured => true;

    public Task<GenerateOrchestratorResult> GenerateAsync(
        GenerationConfig config,
        CancellationToken ct = default,
        Func<ProgressEvent, Task>? onProgress = null
    )
    {
        if (ThrowAiProviderErrorCategory.HasValue)
        {
            var category = ThrowAiProviderErrorCategory.Value;
            ThrowAiProviderErrorCategory = null;
            throw new AiProviderException(
                category,
                "MockProvider",
                attemptsMade: 4,
                retryAfterSeconds: category == AiProviderErrorCategory.RateLimited ? 30 : null,
                $"Simulated {category} error for testing",
                innerException: null);
        }

        if (ShouldThrowOnGenerate)
        {
            ShouldThrowOnGenerate = false;
            throw new InvalidOperationException("Simulated AI failure for testing error handling");
        }

        var prompts = new PromptSet
        {
            Title = $"AI Generated: {config.Description}",
            SystemMessage = config.GenerateSystemMessage
                ? $"You are an expert assistant for: {config.Description}"
                : null,
            Prompts =
                config.GenerateAsPromptChain
                    ?
                    [
                        new PromptMessage { Content = $"Step 1: Analyze {config.Description}" },
                        new PromptMessage { Content = "Step 2: Plan the approach" },
                        new PromptMessage { Content = "Step 3: Execute and deliver" },
                    ]
                : config.GenerateAsPromptTemplate
                    ?
                    [
                        new PromptMessage
                        {
                            Content =
                                $"Write a {{{{tone|enum:formal,casual}}}} response about {{{{topic|string}}}} for: {config.Description}",
                            IsTemplate = true,
                        },
                    ]
                : [new PromptMessage { Content = $"Generated prompt for: {config.Description}" }],
        };

        var evaluation = new PromptEvaluation
        {
            PromptEvaluations = new Dictionary<string, PromptEvaluationEntry>
            {
                ["Clarity"] = new()
                {
                    Score = 7,
                    Feedback = "Clear instructions with minor ambiguities.",
                },
                ["Effectiveness"] = new()
                {
                    Score = 7,
                    Feedback = "Well-structured and practical with minor gaps.",
                },
                ["Completeness"] = new() { Score = 7, Feedback = "Covers main requirements." },
                ["Faithfulness"] = new()
                {
                    Score = 8,
                    Feedback = "Closely matches the stated purpose.",
                },
            },
        };

        var clarification = new ClarificationResult
        {
            Questions =
            [
                new ClarificationQuestion
                {
                    Text = $"What aspects of '{config.Description}' matter most?",
                    Suggestions = ["Accuracy", "Creativity", "Brevity"],
                },
                new ClarificationQuestion
                {
                    Text = "What level of detail is needed?",
                    Suggestions = ["Summary", "Detailed", "Comprehensive"],
                },
                new ClarificationQuestion
                {
                    Text = "Any formatting requirements?",
                    Suggestions = ["Markdown", "Plain text", "Structured JSON"],
                },
            ],
            Enhancements = ["Add structured formatting", "Include examples", "Add error handling"],
        };

        return Task.FromResult(
            new GenerateOrchestratorResult(
                "mock-session-" + Guid.NewGuid().ToString("N")[..8],
                prompts,
                evaluation,
                clarification
            )
        );
    }

    public Task<GenerateOrchestratorResult> RefineAsync(
        string agentSessionId,
        GenerationConfig config,
        PromptEvaluation currentEvaluation,
        List<AnsweredQuestion> answers,
        List<string> selectedEnhancements,
        List<double>? scoreHistory,
        CancellationToken ct = default,
        Func<ProgressEvent, Task>? onProgress = null
    )
    {
        var prompts = new PromptSet
        {
            Title = $"Refined: AI Generated: {config.Description}",
            SystemMessage = config.GenerateSystemMessage
                ? $"You are an expert assistant for: {config.Description}"
                : null,
            Prompts = [new PromptMessage { Content = $"Refined prompt for: {config.Description}" }],
        };

        var evaluation = new PromptEvaluation
        {
            PromptEvaluations = new Dictionary<string, PromptEvaluationEntry>
            {
                ["Clarity"] = new() { Score = 8, Feedback = "Improved clarity after refinement." },
                ["Effectiveness"] = new() { Score = 8, Feedback = "Well-structured and concise." },
                ["Completeness"] = new() { Score = 8, Feedback = "Addresses feedback." },
                ["Faithfulness"] = new() { Score = 9, Feedback = "Closely matches intent." },
            },
        };

        var clarification = new ClarificationResult
        {
            Questions =
            [
                new ClarificationQuestion
                {
                    Text = "Adjust the tone?",
                    Suggestions = ["More formal", "More casual", "Keep as-is"],
                },
                new ClarificationQuestion
                {
                    Text = "Add domain terminology?",
                    Suggestions = ["Yes", "No", "Minimal"],
                },
            ],
            Enhancements =
            [
                "Make it more concise",
                "Add role-playing context",
                "Add output format spec",
            ],
        };

        return Task.FromResult(
            new GenerateOrchestratorResult(agentSessionId, prompts, evaluation, clarification)
        );
    }

    public Task<EnhanceOrchestratorResult> EnhanceAsync(
        string? systemMessage,
        List<PromptInput> prompts,
        GenerationConfig config,
        CancellationToken ct = default,
        Func<ProgressEvent, Task>? onProgress = null
    )
    {
        var enhancedPrompts = new PromptSet
        {
            Title = "Enhanced Entry",
            SystemMessage = systemMessage,
            Prompts = prompts
                .Select(p => new PromptMessage
                {
                    Content = $"Enhanced: {p.Content}",
                    IsTemplate = p.IsTemplate,
                })
                .ToList(),
        };

        var evaluation = new PromptEvaluation
        {
            PromptEvaluations = new Dictionary<string, PromptEvaluationEntry>
            {
                ["Clarity"] = new() { Score = 6, Feedback = "Moderate clarity." },
                ["Effectiveness"] = new()
                {
                    Score = 6,
                    Feedback = "Reasonable but needs tighter constraints.",
                },
                ["Completeness"] = new() { Score = 4, Feedback = "Missing edge cases." },
                ["Faithfulness"] = new() { Score = 7, Feedback = "Aligns with original intent." },
            },
        };

        var clarification = new ClarificationResult
        {
            Questions =
            [
                new ClarificationQuestion
                {
                    Text = "What improvements are you looking for?",
                    Suggestions = ["Clarity", "Completeness", "Structure"],
                },
                new ClarificationQuestion
                {
                    Text = "Is the tone appropriate?",
                    Suggestions = ["Yes", "Too formal", "Too casual"],
                },
            ],
            Enhancements = ["Improve clarity", "Add constraints", "Optimize for consistency"],
        };

        return Task.FromResult(
            new EnhanceOrchestratorResult(
                "mock-enhance-session",
                enhancedPrompts,
                evaluation,
                clarification
            )
        );
    }

    public Task<AgentResult<string>> GenerateSystemMessageAsync(
        List<PromptInput> prompts,
        CancellationToken ct = default
    )
    {
        return Task.FromResult(
            new AgentResult<string>("You are a helpful AI assistant specialized in this domain.")
        );
    }

    public Task<AgentResult<List<PromptInput>>> DecomposeAsync(
        string promptContent,
        bool isTemplate = false,
        string? systemMessage = null,
        CancellationToken ct = default
    )
    {
        return Task.FromResult(
            new AgentResult<List<PromptInput>>(
                new List<PromptInput>
                {
                    new("Step 1: Understand the task"),
                    new("Step 2: Research and plan"),
                    new("Step 3: Execute and deliver"),
                }
            )
        );
    }

    public Task<AgentResult<Dictionary<string, string>>> FillTemplateFieldsAsync(
        List<TemplateFieldInfo> fields,
        List<PromptInput> prompts,
        string? systemMessage = null,
        CancellationToken ct = default
    )
    {
        var values = fields.ToDictionary(
            f => f.Name,
            f => f.EnumValues is { Count: > 0 } ? f.EnumValues[0] : $"example-{f.Name}"
        );
        return Task.FromResult(new AgentResult<Dictionary<string, string>>(values));
    }

    public Task<AgentResult<string>> PolishDescriptionAsync(
        string description,
        CancellationToken ct = default
    )
    {
        return Task.FromResult(
            new AgentResult<string>($"Polished: {description}")
        );
    }
}
