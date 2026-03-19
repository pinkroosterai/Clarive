using Clarive.Api.Models.Enums;
using Clarive.Api.Services;
using FluentAssertions;

namespace Clarive.Api.UnitTests.Services;

public class AiSettingsTests
{
    [Theory]
    [InlineData(AiActionType.Generation)]
    [InlineData(AiActionType.Evaluation)]
    [InlineData(AiActionType.Clarification)]
    [InlineData(AiActionType.SystemMessage)]
    [InlineData(AiActionType.Decomposition)]
    [InlineData(AiActionType.FillTemplateFields)]
    [InlineData(AiActionType.PlaygroundJudge)]
    public void GetActionConfig_ConfigurableAction_ReturnsNonNull(AiActionType actionType)
    {
        var settings = new AiSettings();

        var config = settings.GetActionConfig(actionType);

        config.Should().NotBeNull();
    }

    [Fact]
    public void GetActionConfig_PlaygroundTest_ReturnsNull()
    {
        var settings = new AiSettings();

        var config = settings.GetActionConfig(AiActionType.PlaygroundTest);

        config.Should().BeNull();
    }

    [Fact]
    public void GetActionConfig_Generation_ReturnsGenerationConfig()
    {
        var settings = new AiSettings
        {
            Generation = new ActionAiConfig
            {
                Model = "gpt-4o",
                ProviderId = "p1",
                Temperature = 0.9f,
            },
        };

        var config = settings.GetActionConfig(AiActionType.Generation);

        config!.Model.Should().Be("gpt-4o");
        config.ProviderId.Should().Be("p1");
        config.Temperature.Should().Be(0.9f);
    }

    [Fact]
    public void GetActionConfig_Evaluation_ReturnsEvaluationConfig()
    {
        var settings = new AiSettings
        {
            Evaluation = new ActionAiConfig { Model = "gpt-4o-mini", MaxTokens = 2048 },
        };

        var config = settings.GetActionConfig(AiActionType.Evaluation);

        config!.Model.Should().Be("gpt-4o-mini");
        config.MaxTokens.Should().Be(2048);
    }

    [Fact]
    public void GetActionConfig_EachAction_ReturnsDifferentConfig()
    {
        var settings = new AiSettings
        {
            Generation = new ActionAiConfig { Model = "gen-model" },
            Evaluation = new ActionAiConfig { Model = "eval-model" },
            Clarification = new ActionAiConfig { Model = "clar-model" },
            SystemMessage = new ActionAiConfig { Model = "sys-model" },
            Decomposition = new ActionAiConfig { Model = "dec-model" },
            FillTemplateFields = new ActionAiConfig { Model = "fill-model" },
            PlaygroundJudge = new ActionAiConfig { Model = "judge-model" },
        };

        settings.GetActionConfig(AiActionType.Generation)!.Model.Should().Be("gen-model");
        settings.GetActionConfig(AiActionType.Evaluation)!.Model.Should().Be("eval-model");
        settings.GetActionConfig(AiActionType.Clarification)!.Model.Should().Be("clar-model");
        settings.GetActionConfig(AiActionType.SystemMessage)!.Model.Should().Be("sys-model");
        settings.GetActionConfig(AiActionType.Decomposition)!.Model.Should().Be("dec-model");
        settings.GetActionConfig(AiActionType.FillTemplateFields)!.Model.Should().Be("fill-model");
        settings.GetActionConfig(AiActionType.PlaygroundJudge)!.Model.Should().Be("judge-model");
    }

    [Fact]
    public void GetActionConfig_DefaultSettings_AllModelsEmpty()
    {
        var settings = new AiSettings();

        foreach (
            var action in new[]
            {
                AiActionType.Generation,
                AiActionType.Evaluation,
                AiActionType.Clarification,
                AiActionType.SystemMessage,
                AiActionType.Decomposition,
                AiActionType.FillTemplateFields,
                AiActionType.PlaygroundJudge,
            }
        )
        {
            var config = settings.GetActionConfig(action);
            config!.Model.Should().BeEmpty($"default {action} model should be empty");
        }
    }

    [Fact]
    public void ActionAiConfig_DefaultValues_AreCorrect()
    {
        var config = new ActionAiConfig();

        config.Model.Should().BeEmpty();
        config.ProviderId.Should().BeEmpty();
        config.Temperature.Should().BeNull();
        config.MaxTokens.Should().BeNull();
        config.ReasoningEffort.Should().BeNull();
    }
}
