using Clarive.AI.Models;
using Clarive.AI.Evaluation;
using Clarive.Domain.ValueObjects;
using FluentAssertions;

namespace Clarive.Api.UnitTests.Services;

public class EvaluationNormalizerTests
{
    [Fact]
    public void ComputeAverageScore_MultipleEntries_ReturnsAverage()
    {
        var eval = new PromptEvaluation
        {
            PromptEvaluations = new Dictionary<string, PromptEvaluationEntry>
            {
                ["Clarity"] = new() { Score = 8, Feedback = "Good" },
                ["Effectiveness"] = new() { Score = 6, Feedback = "OK" },
            },
        };

        EvaluationNormalizer.ComputeAverageScore(eval).Should().Be(7.0);
    }

    [Fact]
    public void ComputeAverageScore_Empty_ReturnsZero()
    {
        var eval = new PromptEvaluation();
        EvaluationNormalizer.ComputeAverageScore(eval).Should().Be(0);
    }

    [Fact]
    public void Normalize_ExactCaseMatch_MapsCorrectly()
    {
        var raw = new PromptEvaluation
        {
            PromptEvaluations = new Dictionary<string, PromptEvaluationEntry>
            {
                ["Clarity"] = new() { Score = 9, Feedback = "Excellent" },
                ["Effectiveness"] = new() { Score = 7, Feedback = "Good" },
                ["Completeness"] = new() { Score = 8, Feedback = "Thorough" },
                ["Faithfulness"] = new() { Score = 6, Feedback = "Mostly" },
            },
        };

        var result = EvaluationNormalizer.Normalize(raw);

        result.PromptEvaluations.Should().HaveCount(4);
        result.PromptEvaluations["Clarity"].Score.Should().Be(9);
        result.PromptEvaluations["Effectiveness"].Score.Should().Be(7);
        result.PromptEvaluations["Completeness"].Score.Should().Be(8);
        result.PromptEvaluations["Faithfulness"].Score.Should().Be(6);
    }

    [Fact]
    public void Normalize_CaseInsensitiveMatch_MapsCorrectly()
    {
        var raw = new PromptEvaluation
        {
            PromptEvaluations = new Dictionary<string, PromptEvaluationEntry>
            {
                ["clarity"] = new() { Score = 9, Feedback = "F" },
                ["EFFECTIVENESS"] = new() { Score = 7, Feedback = "F" },
                ["completeness"] = new() { Score = 8, Feedback = "F" },
                ["faithfulness"] = new() { Score = 6, Feedback = "F" },
            },
        };

        var result = EvaluationNormalizer.Normalize(raw);

        result.PromptEvaluations["Clarity"].Score.Should().Be(9);
        result.PromptEvaluations["Effectiveness"].Score.Should().Be(7);
    }

    [Fact]
    public void Normalize_SubstringMatch_MapsCorrectly()
    {
        var raw = new PromptEvaluation
        {
            PromptEvaluations = new Dictionary<string, PromptEvaluationEntry>
            {
                ["prompt_clarity"] = new() { Score = 9, Feedback = "F" },
                ["overall_effectiveness"] = new() { Score = 7, Feedback = "F" },
                ["Completeness"] = new() { Score = 8, Feedback = "F" },
                ["Faithfulness"] = new() { Score = 6, Feedback = "F" },
            },
        };

        var result = EvaluationNormalizer.Normalize(raw);

        result.PromptEvaluations["Clarity"].Score.Should().Be(9);
        result.PromptEvaluations["Effectiveness"].Score.Should().Be(7);
    }

    [Fact]
    public void Normalize_TypoMatch_MapsViaLevenshtein()
    {
        var raw = new PromptEvaluation
        {
            PromptEvaluations = new Dictionary<string, PromptEvaluationEntry>
            {
                ["Claritiy"] = new() { Score = 9, Feedback = "F" },
                ["Effectiveness"] = new() { Score = 7, Feedback = "F" },
                ["Completness"] = new() { Score = 8, Feedback = "F" },
                ["Faithfulness"] = new() { Score = 6, Feedback = "F" },
            },
        };

        var result = EvaluationNormalizer.Normalize(raw);

        result.PromptEvaluations["Clarity"].Score.Should().Be(9);
        result.PromptEvaluations["Completeness"].Score.Should().Be(8);
    }

    [Fact]
    public void Normalize_MissingDimension_FillsWithZeroScore()
    {
        var raw = new PromptEvaluation
        {
            PromptEvaluations = new Dictionary<string, PromptEvaluationEntry>
            {
                ["Clarity"] = new() { Score = 9, Feedback = "F" },
            },
        };

        var result = EvaluationNormalizer.Normalize(raw);

        result.PromptEvaluations.Should().HaveCount(4);
        result.PromptEvaluations["Effectiveness"].Score.Should().Be(0);
        result.PromptEvaluations["Effectiveness"].Feedback.Should().Contain("missing");
    }

    [Fact]
    public void Normalize_AllMissing_FillsAllWithZero()
    {
        var raw = new PromptEvaluation();

        var result = EvaluationNormalizer.Normalize(raw);

        result.PromptEvaluations.Should().HaveCount(4);
        result.PromptEvaluations.Values.Should().AllSatisfy(e => e.Score.Should().Be(0));
    }
}
