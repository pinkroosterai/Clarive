using Clarive.Api.Models.Agents;
using Clarive.Domain.ValueObjects;
using Clarive.Api.Services.Agents;
using FluentAssertions;

namespace Clarive.Api.UnitTests.Services;

public class OutputEvaluationNormalizerTests
{
    [Fact]
    public void Normalize_AllDimensionsPresent_MapsCorrectly()
    {
        var raw = new OutputEvaluation
        {
            Dimensions = new Dictionary<string, OutputEvaluationEntry>
            {
                ["Accuracy"] = new() { Score = 9, Feedback = "Excellent" },
                ["Helpfulness"] = new() { Score = 7, Feedback = "Good" },
                ["Relevance"] = new() { Score = 8, Feedback = "On point" },
                ["Coherence"] = new() { Score = 6, Feedback = "Mostly clear" },
                ["Safety"] = new() { Score = 10, Feedback = "Safe" },
            },
        };

        var result = OutputEvaluationNormalizer.Normalize(raw);

        result.Dimensions.Should().HaveCount(5);
        result.Dimensions["Accuracy"].Score.Should().Be(9);
        result.Dimensions["Helpfulness"].Score.Should().Be(7);
        result.Dimensions["Relevance"].Score.Should().Be(8);
        result.Dimensions["Coherence"].Score.Should().Be(6);
        result.Dimensions["Safety"].Score.Should().Be(10);
        result.AverageScore.Should().Be(8.0);
    }

    [Fact]
    public void Normalize_CaseInsensitiveMatch_MapsCorrectly()
    {
        var raw = new OutputEvaluation
        {
            Dimensions = new Dictionary<string, OutputEvaluationEntry>
            {
                ["accuracy"] = new() { Score = 9, Feedback = "F" },
                ["HELPFULNESS"] = new() { Score = 7, Feedback = "F" },
                ["relevance"] = new() { Score = 8, Feedback = "F" },
                ["coherence"] = new() { Score = 6, Feedback = "F" },
                ["safety"] = new() { Score = 10, Feedback = "F" },
            },
        };

        var result = OutputEvaluationNormalizer.Normalize(raw);

        result.Dimensions["Accuracy"].Score.Should().Be(9);
        result.Dimensions["Helpfulness"].Score.Should().Be(7);
    }

    [Fact]
    public void Normalize_SubstringMatch_MapsCorrectly()
    {
        var raw = new OutputEvaluation
        {
            Dimensions = new Dictionary<string, OutputEvaluationEntry>
            {
                ["output_accuracy"] = new() { Score = 9, Feedback = "F" },
                ["response_helpfulness"] = new() { Score = 7, Feedback = "F" },
                ["Relevance"] = new() { Score = 8, Feedback = "F" },
                ["Coherence"] = new() { Score = 6, Feedback = "F" },
                ["Safety"] = new() { Score = 10, Feedback = "F" },
            },
        };

        var result = OutputEvaluationNormalizer.Normalize(raw);

        result.Dimensions["Accuracy"].Score.Should().Be(9);
        result.Dimensions["Helpfulness"].Score.Should().Be(7);
    }

    [Fact]
    public void Normalize_TypoMatch_MapsViaLevenshtein()
    {
        var raw = new OutputEvaluation
        {
            Dimensions = new Dictionary<string, OutputEvaluationEntry>
            {
                ["Accurcy"] = new() { Score = 9, Feedback = "F" },
                ["Helpfulness"] = new() { Score = 7, Feedback = "F" },
                ["Relevence"] = new() { Score = 8, Feedback = "F" },
                ["Coherence"] = new() { Score = 6, Feedback = "F" },
                ["Safety"] = new() { Score = 10, Feedback = "F" },
            },
        };

        var result = OutputEvaluationNormalizer.Normalize(raw);

        result.Dimensions["Accuracy"].Score.Should().Be(9);
        result.Dimensions["Relevance"].Score.Should().Be(8);
    }

    [Fact]
    public void Normalize_MissingDimension_FillsWithZeroScore()
    {
        var raw = new OutputEvaluation
        {
            Dimensions = new Dictionary<string, OutputEvaluationEntry>
            {
                ["Accuracy"] = new() { Score = 9, Feedback = "F" },
                ["Helpfulness"] = new() { Score = 7, Feedback = "F" },
            },
        };

        var result = OutputEvaluationNormalizer.Normalize(raw);

        result.Dimensions.Should().HaveCount(5);
        result.Dimensions["Relevance"].Score.Should().Be(0);
        result.Dimensions["Relevance"].Feedback.Should().Contain("missing");
        result.Dimensions["Coherence"].Score.Should().Be(0);
        result.Dimensions["Safety"].Score.Should().Be(0);
    }

    [Fact]
    public void Normalize_AllMissing_FillsAllWithZero()
    {
        var raw = new OutputEvaluation();

        var result = OutputEvaluationNormalizer.Normalize(raw);

        result.Dimensions.Should().HaveCount(5);
        result.Dimensions.Values.Should().AllSatisfy(e => e.Score.Should().Be(0));
    }

    [Fact]
    public void AverageScore_ComputesCorrectly()
    {
        var eval = new OutputEvaluation
        {
            Dimensions = new Dictionary<string, OutputEvaluationEntry>
            {
                ["Accuracy"] = new() { Score = 10 },
                ["Helpfulness"] = new() { Score = 8 },
                ["Relevance"] = new() { Score = 6 },
                ["Coherence"] = new() { Score = 4 },
                ["Safety"] = new() { Score = 2 },
            },
        };

        eval.AverageScore.Should().Be(6.0);
    }

    [Fact]
    public void AverageScore_Empty_ReturnsZero()
    {
        var eval = new OutputEvaluation();
        eval.AverageScore.Should().Be(0);
    }
}
