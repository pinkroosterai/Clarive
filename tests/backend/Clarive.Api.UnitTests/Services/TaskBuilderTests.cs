using Clarive.Api.Models.Agents;
using Clarive.Api.Models.Requests;
using Clarive.Api.Services.Agents;
using FluentAssertions;

namespace Clarive.Api.UnitTests.Services;

public class TaskBuilderTests
{
    private static GenerationConfig DefaultConfig(string description = "Test purpose") => new()
    {
        Description = description
    };

    [Fact]
    public void BuildGenerationTask_IncludesDescription()
    {
        var result = TaskBuilder.BuildGenerationTask(DefaultConfig("Analyze data"));
        result.Should().Contain("Analyze data");
    }

    [Fact]
    public void BuildGenerationTask_SystemMessage_IncludesRequirement()
    {
        var config = DefaultConfig() with { GenerateSystemMessage = true };
        var result = TaskBuilder.BuildGenerationTask(config);
        result.Should().Contain("SystemMessage field");
    }

    [Fact]
    public void BuildGenerationTask_Template_IncludesTemplateSyntax()
    {
        var config = DefaultConfig() with { GenerateAsPromptTemplate = true };
        var result = TaskBuilder.BuildGenerationTask(config);
        result.Should().Contain("{{name}}");
    }

    [Fact]
    public void BuildGenerationTask_Chain_IncludesChainRequirement()
    {
        var config = DefaultConfig() with { GenerateAsPromptChain = true };
        var result = TaskBuilder.BuildGenerationTask(config);
        result.Should().Contain("prompt chain");
    }

    [Fact]
    public void BuildGenerationTask_WithTools_IncludesToolNames()
    {
        var config = DefaultConfig() with
        {
            SelectedTools = [new ToolInfo("web_search", "Search the web")]
        };
        var result = TaskBuilder.BuildGenerationTask(config);
        result.Should().Contain("web_search").And.Contain("Search the web");
    }

    [Fact]
    public void BuildGenerationTask_NoSpecialRequirements_IncludesDefault()
    {
        var result = TaskBuilder.BuildGenerationTask(DefaultConfig());
        result.Should().Contain("No special requirements");
    }

    [Fact]
    public void BuildEvaluationTask_IncludesDescriptionAndPrompts()
    {
        var prompts = new PromptSet
        {
            Prompts = [new PromptMessage { Content = "Do X" }]
        };
        var result = TaskBuilder.BuildEvaluationTask(DefaultConfig("My purpose"), prompts);

        result.Should().Contain("My purpose").And.Contain("Do X");
    }

    [Fact]
    public void BuildClarificationTask_IncludesPromptContent()
    {
        var prompts = new PromptSet
        {
            Prompts = [new PromptMessage { Content = "Analyze {{topic}}", IsTemplate = true }]
        };
        var config = DefaultConfig() with { GenerateAsPromptTemplate = true };
        var result = TaskBuilder.BuildClarificationTask(config, prompts);

        result.Should().Contain("{{topic}}").And.Contain("placeholders");
    }

    [Fact]
    public void BuildClarificationTask_NoTemplate_NoPlaceholderSection()
    {
        var prompts = new PromptSet
        {
            Prompts = [new PromptMessage { Content = "Analyze data" }]
        };
        var result = TaskBuilder.BuildClarificationTask(DefaultConfig(), prompts);

        result.Should().NotContain("placeholders are already parameterized");
    }

    [Fact]
    public void BuildRevisionTask_IncludesEvaluationAndAnswers()
    {
        var evaluation = new PromptEvaluation
        {
            PromptEvaluations = new Dictionary<string, PromptEvaluationEntry>
            {
                ["Clarity"] = new() { Score = 6, Feedback = "Needs work" }
            }
        };
        var answers = new List<AnsweredQuestion>
        {
            new("What tone?", "Formal")
        };

        var result = TaskBuilder.BuildRevisionTask(
            DefaultConfig(), evaluation, answers, ["Add examples"]);

        result.Should().Contain("Clarity").And.Contain("6/10")
            .And.Contain("Formal").And.Contain("Add examples");
    }

    [Fact]
    public void BuildRevisionTask_NoAnswers_ShowsNoClarifications()
    {
        var evaluation = new PromptEvaluation
        {
            PromptEvaluations = new Dictionary<string, PromptEvaluationEntry>
            {
                ["Clarity"] = new() { Score = 8, Feedback = "OK" }
            }
        };

        var result = TaskBuilder.BuildRevisionTask(DefaultConfig(), evaluation, [], []);

        result.Should().Contain("No clarifications provided");
        result.Should().Contain("No enhancements selected");
    }

    [Fact]
    public void BuildRevisionTask_WithScoreHistory_IncludesTrend()
    {
        var evaluation = new PromptEvaluation
        {
            PromptEvaluations = new Dictionary<string, PromptEvaluationEntry>
            {
                ["Clarity"] = new() { Score = 8, Feedback = "OK" }
            }
        };

        var result = TaskBuilder.BuildRevisionTask(
            DefaultConfig(), evaluation, [], [],
            scoreHistory: [5.0, 6.5, 7.0]);

        result.Should().Contain("Score trend").And.Contain("improving");
    }

    [Fact]
    public void BuildSystemMessageTask_IncludesPromptContent()
    {
        var prompts = new List<PromptInput>
        {
            new("Write a poem about nature"),
            new("Make it rhyme")
        };

        var result = TaskBuilder.BuildSystemMessageTask(prompts);

        result.Should().Contain("Write a poem about nature").And.Contain("Make it rhyme");
    }

    [Fact]
    public void BuildDecompositionTask_BasicPrompt_IncludesContent()
    {
        var result = TaskBuilder.BuildDecompositionTask("Analyze sentiment", false, null);

        result.Should().Contain("Analyze sentiment").And.Contain("Decompose");
    }

    [Fact]
    public void BuildDecompositionTask_Template_IncludesTemplateNote()
    {
        var result = TaskBuilder.BuildDecompositionTask("Analyze {{topic}}", true, null);

        result.Should().Contain("template").And.Contain("template variables");
    }

    [Fact]
    public void BuildDecompositionTask_WithSystemMessage_IncludesContext()
    {
        var result = TaskBuilder.BuildDecompositionTask("Do X", false, "You are an expert");

        result.Should().Contain("You are an expert");
    }

    [Fact]
    public void BuildEnhanceBootstrapTask_IncludesPrompts()
    {
        var prompts = new List<PromptInput>
        {
            new("Step 1", true),
            new("Step 2")
        };

        var result = TaskBuilder.BuildEnhanceBootstrapTask("System msg", prompts);

        result.Should().Contain("System msg").And.Contain("Step 1")
            .And.Contain("(template)").And.Contain("Step 2");
    }

    [Fact]
    public void BuildEnhanceBootstrapTask_NoSystemMessage_OmitsSection()
    {
        var prompts = new List<PromptInput> { new("Do something") };

        var result = TaskBuilder.BuildEnhanceBootstrapTask(null, prompts);

        result.Should().NotContain("system message");
        result.Should().Contain("Do something");
    }

    [Fact]
    public void FormatPromptsAsText_WithSystemMessage_IncludesLabel()
    {
        var prompts = new PromptSet
        {
            SystemMessage = "You are an expert",
            Prompts = [new PromptMessage { Content = "Do X" }]
        };

        var result = TaskBuilder.FormatPromptsAsText(prompts);

        result.Should().Contain("[System Message]").And.Contain("You are an expert")
            .And.Contain("[Step 1]").And.Contain("Do X");
    }

    [Fact]
    public void FormatPromptsAsText_TemplatePrompt_LabelsAsTemplate()
    {
        var prompts = new PromptSet
        {
            Prompts = [new PromptMessage { Content = "Analyze {{topic}}", IsTemplate = true }]
        };

        var result = TaskBuilder.FormatPromptsAsText(prompts);

        result.Should().Contain("[Step 1 - Template]");
    }
}
