using Clarive.AI.Prompts;
using Clarive.Domain.ValueObjects;
using FluentAssertions;

namespace Clarive.Api.UnitTests.Services;

public class AgentInstructionsTests
{
    [Fact]
    public void BuildGeneration_WebSearchEnabled_IncludesWebResearchSection()
    {
        var config = new GenerationConfig { Description = "Test prompt", EnableWebSearch = true };

        var result = AgentInstructions.BuildGeneration(config);

        result.Should().Contain("Web Research");
        result.Should().Contain("web search and content extraction tools");
    }

    [Fact]
    public void BuildGeneration_WebSearchDisabled_ExcludesWebResearchSection()
    {
        var config = new GenerationConfig { Description = "Test prompt", EnableWebSearch = false };

        var result = AgentInstructions.BuildGeneration(config);

        result.Should().NotContain("Web Research");
        result.Should().NotContain("web search and content extraction tools");
    }

    [Fact]
    public void BuildGeneration_DefaultConfig_ExcludesWebResearch()
    {
        var config = new GenerationConfig { Description = "Test prompt" };

        var result = AgentInstructions.BuildGeneration(config);

        result.Should().NotContain("Web Research");
    }

    private static GenerationConfig ConfigWith(
        bool systemMessage = false,
        bool template = false,
        bool chain = false,
        bool webSearch = false,
        List<ToolInfo>? tools = null
    ) =>
        new()
        {
            Description = "Test",
            GenerateSystemMessage = systemMessage,
            GenerateAsPromptTemplate = template,
            GenerateAsPromptChain = chain,
            EnableWebSearch = webSearch,
            SelectedTools = tools ?? [],
        };

    // ── BuildGeneration conditional sections ──

    [Fact]
    public void BuildGeneration_SystemMessageEnabled_IncludesSystemMessageSection()
    {
        var result = AgentInstructions.BuildGeneration(ConfigWith(systemMessage: true));
        result.Should().Contain("SystemMessage field");
    }

    [Fact]
    public void BuildGeneration_SystemMessageDisabled_IncludesDisabledSection()
    {
        var result = AgentInstructions.BuildGeneration(ConfigWith(systemMessage: false));
        result.Should().Contain("Do NOT generate a system message");
    }

    [Fact]
    public void BuildGeneration_TemplateEnabled_IncludesTemplateSection()
    {
        var result = AgentInstructions.BuildGeneration(ConfigWith(template: true));
        result.Should().Contain("placeholder variables");
    }

    [Fact]
    public void BuildGeneration_TemplateDisabled_IncludesDisabledSection()
    {
        var result = AgentInstructions.BuildGeneration(ConfigWith(template: false));
        result.Should().Contain("Do NOT use placeholder");
    }

    [Fact]
    public void BuildGeneration_ChainEnabled_IncludesChainSection()
    {
        var result = AgentInstructions.BuildGeneration(ConfigWith(chain: true));
        result.Should().Contain("multi-step prompt chain");
    }

    [Fact]
    public void BuildGeneration_ChainDisabled_IncludesDisabledSection()
    {
        var result = AgentInstructions.BuildGeneration(ConfigWith(chain: false));
        result.Should().Contain("Do NOT structure the output as a sequential");
    }

    [Fact]
    public void BuildGeneration_WithTools_IncludesToolGuidance()
    {
        var result = AgentInstructions.BuildGeneration(
            ConfigWith(tools: [new ToolInfo("search", "Search web")])
        );
        result.Should().Contain("tool's purpose and usage rules");
    }

    [Fact]
    public void BuildGeneration_WithToolsAndSystemMessage_UsesSystemMessageToolGuidance()
    {
        var result = AgentInstructions.BuildGeneration(
            ConfigWith(systemMessage: true, tools: [new ToolInfo("search", "Search")])
        );
        result.Should().Contain("in the system message");
    }

    [Fact]
    public void BuildGeneration_WithToolsNoSystemMessage_UsesFirstPromptToolGuidance()
    {
        var result = AgentInstructions.BuildGeneration(
            ConfigWith(systemMessage: false, tools: [new ToolInfo("search", "Search")])
        );
        result.Should().Contain("in the first prompt");
    }

    // ── BuildEvaluation ──

    [Fact]
    public void BuildEvaluation_Default_IncludesCore()
    {
        var result = AgentInstructions.BuildEvaluation(ConfigWith());
        result
            .Should()
            .Contain("prompt quality evaluator")
            .And.Contain("Clarity")
            .And.Contain("Effectiveness");
    }

    [Fact]
    public void BuildEvaluation_SystemMessageEnabled_IncludesSystemMessageCriteria()
    {
        var result = AgentInstructions.BuildEvaluation(ConfigWith(systemMessage: true));
        result.Should().Contain("system message is present");
    }

    [Fact]
    public void BuildEvaluation_SystemMessageDisabled_IncludesDisabledCriteria()
    {
        var result = AgentInstructions.BuildEvaluation(ConfigWith(systemMessage: false));
        result.Should().Contain("deduct if a SystemMessage is present");
    }

    [Fact]
    public void BuildEvaluation_TemplateEnabled_IncludesTemplateCriteria()
    {
        var result = AgentInstructions.BuildEvaluation(ConfigWith(template: true));
        result.Should().Contain("placeholder variables");
    }

    [Fact]
    public void BuildEvaluation_TemplateDisabled_IncludesDisabledCriteria()
    {
        var result = AgentInstructions.BuildEvaluation(ConfigWith(template: false));
        result.Should().Contain("deduct if any prompt contains {{placeholder}}");
    }

    [Fact]
    public void BuildEvaluation_ChainEnabled_IncludesChainCriteria()
    {
        var result = AgentInstructions.BuildEvaluation(ConfigWith(chain: true));
        result.Should().Contain("necessary sequence");
    }

    [Fact]
    public void BuildEvaluation_ChainDisabled_IncludesDisabledCriteria()
    {
        var result = AgentInstructions.BuildEvaluation(ConfigWith(chain: false));
        result.Should().Contain("Prompts should be standalone");
    }

    [Fact]
    public void BuildEvaluation_WithTools_IncludesToolCriteria()
    {
        var result = AgentInstructions.BuildEvaluation(
            ConfigWith(tools: [new ToolInfo("search", "Search")])
        );
        result.Should().Contain("every specified tool");
    }

    [Fact]
    public void BuildEvaluation_NoTools_ExcludesToolCriteria()
    {
        var result = AgentInstructions.BuildEvaluation(ConfigWith());
        result.Should().NotContain("every specified tool");
    }
}
