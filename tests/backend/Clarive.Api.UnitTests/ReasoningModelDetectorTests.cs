using Clarive.Api.Services;
using FluentAssertions;
using Xunit;

namespace Clarive.Api.UnitTests;

public class ReasoningModelDetectorTests
{
    [Theory]
    [InlineData("o1", true)]
    [InlineData("o1-mini", true)]
    [InlineData("o1-pro", true)]
    [InlineData("o3", true)]
    [InlineData("o3-mini", true)]
    [InlineData("o3-pro", true)]
    [InlineData("o3-deep-research", true)]
    [InlineData("o3-mini-2025-01-31", true)]
    [InlineData("o4-mini", true)]
    [InlineData("o4-mini-deep-research", true)]
    [InlineData("deepseek-reasoner", true)]
    [InlineData("deepseek-reasoner-v2", true)]
    [InlineData("qwq", true)]
    [InlineData("qwq-32b", true)]
    // Case-insensitive
    [InlineData("O1", true)]
    [InlineData("O3", true)]
    [InlineData("O3-Mini", true)]
    [InlineData("O4-MINI", true)]
    [InlineData("DEEPSEEK-REASONER", true)]
    [InlineData("QWQ", true)]
    // Standard models — should NOT match
    [InlineData("gpt-4o", false)]
    [InlineData("gpt-4o-mini", false)]
    [InlineData("gpt-4", false)]
    [InlineData("claude-3-opus", false)]
    [InlineData("claude-3.5-sonnet", false)]
    [InlineData("deepseek-chat", false)]
    [InlineData("deepseek-coder", false)]
    [InlineData("llama-3-70b", false)]
    // Edge cases — should NOT match (prefix boundary)
    [InlineData("o10-something", false)]
    [InlineData("o12", false)]
    [InlineData("o3x-custom", false)]
    [InlineData("qwqx", false)]
    // Empty / null-like
    [InlineData("", false)]
    [InlineData("  ", false)]
    public void IsReasoningModel_MatchesCorrectly(string modelId, bool expected)
    {
        ReasoningModelDetector.IsReasoningModel(modelId).Should().Be(expected);
    }
}
