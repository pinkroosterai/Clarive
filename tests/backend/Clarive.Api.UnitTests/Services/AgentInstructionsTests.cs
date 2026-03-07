using Clarive.Api.Models.Agents;
using Clarive.Api.Services.Agents;
using FluentAssertions;

namespace Clarive.Api.UnitTests.Services;

public class AgentInstructionsTests
{
    [Fact]
    public void BuildGeneration_WebSearchEnabled_IncludesWebResearchSection()
    {
        var config = new GenerationConfig
        {
            Description = "Test prompt",
            EnableWebSearch = true
        };

        var result = AgentInstructions.BuildGeneration(config);

        result.Should().Contain("Web Research");
        result.Should().Contain("web search and content extraction tools");
    }

    [Fact]
    public void BuildGeneration_WebSearchDisabled_ExcludesWebResearchSection()
    {
        var config = new GenerationConfig
        {
            Description = "Test prompt",
            EnableWebSearch = false
        };

        var result = AgentInstructions.BuildGeneration(config);

        result.Should().NotContain("Web Research");
        result.Should().NotContain("web search and content extraction tools");
    }

    [Fact]
    public void BuildGeneration_DefaultConfig_ExcludesWebResearch()
    {
        var config = new GenerationConfig
        {
            Description = "Test prompt"
        };

        var result = AgentInstructions.BuildGeneration(config);

        result.Should().NotContain("Web Research");
    }
}
