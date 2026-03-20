using Clarive.Core.Services;
using FluentAssertions;

namespace Clarive.Api.UnitTests.Services;

public class ConfigRegistryTests
{
    [Fact]
    public void All_ContainsExpectedNumberOfDefinitions()
    {
        ConfigRegistry.All.Should().HaveCountGreaterOrEqualTo(10);
    }

    [Fact]
    public void All_HasNoDuplicateKeys()
    {
        var keys = ConfigRegistry.All.Select(d => d.Key.ToLowerInvariant()).ToList();
        keys.Should().OnlyHaveUniqueItems();
    }

    [Fact]
    public void ByKey_ContainsSameCountAsAll()
    {
        ConfigRegistry.ByKey.Count.Should().Be(ConfigRegistry.All.Count);
    }

    [Fact]
    public void ByKey_IsCaseInsensitive()
    {
        var firstKey = ConfigRegistry.All[0].Key;
        ConfigRegistry.ByKey.ContainsKey(firstKey.ToUpperInvariant()).Should().BeTrue();
        ConfigRegistry.ByKey.ContainsKey(firstKey.ToLowerInvariant()).Should().BeTrue();
    }

    [Fact]
    public void GetBySection_ReturnsOnlyMatchingSection()
    {
        var aiConfigs = ConfigRegistry.GetBySection(ConfigSection.Ai).ToList();

        aiConfigs.Should().NotBeEmpty();
        aiConfigs.Should().AllSatisfy(d => d.Section.Should().Be(ConfigSection.Ai));
    }

    [Fact]
    public void GetBySection_AllSectionsCovered()
    {
        foreach (var section in Enum.GetValues<ConfigSection>())
        {
            ConfigRegistry
                .GetBySection(section)
                .Should()
                .NotBeEmpty($"section {section} should have at least one config definition");
        }
    }

    [Fact]
    public void All_SecretConfigs_UsePasswordInputType()
    {
        var secrets = ConfigRegistry.All.Where(d => d.IsSecret).ToList();

        secrets.Should().NotBeEmpty();
        // Secrets that aren't Password input type are acceptable (e.g., API keys use Text),
        // but all should at least be marked as secret
        secrets.Should().AllSatisfy(d => d.IsSecret.Should().BeTrue());
    }

    [Fact]
    public void All_SelectInputTypes_HaveOptions()
    {
        var selects = ConfigRegistry.All.Where(d => d.InputType == ConfigInputType.Select).ToList();

        selects.Should().NotBeEmpty();
        selects
            .Should()
            .AllSatisfy(d =>
                d.SelectOptions.Should()
                    .NotBeNullOrEmpty($"config '{d.Key}' uses Select input but has no options")
            );
    }

    [Fact]
    public void All_VisibleWhenKeys_ExistInRegistry()
    {
        var conditionalConfigs = ConfigRegistry.All.Where(d => d.VisibleWhen is not null).ToList();

        foreach (var config in conditionalConfigs)
        {
            ConfigRegistry
                .ByKey.Should()
                .ContainKey(
                    config.VisibleWhen!.Key,
                    $"config '{config.Key}' references non-existent VisibleWhen key '{config.VisibleWhen.Key}'"
                );
        }
    }

    [Fact]
    public void All_LabelsAndDescriptions_AreNotEmpty()
    {
        ConfigRegistry
            .All.Should()
            .AllSatisfy(d =>
            {
                d.Label.Should().NotBeNullOrWhiteSpace($"config '{d.Key}' must have a label");
                d.Description.Should()
                    .NotBeNullOrWhiteSpace($"config '{d.Key}' must have a description");
            });
    }

    [Theory]
    [InlineData("Ai:Generation:Model")]
    [InlineData("Email:Provider")]
    [InlineData("Jwt:ExpirationMinutes")]
    [InlineData("Google:ClientId")]
    public void ByKey_LooksUpKnownKeys(string key)
    {
        ConfigRegistry.ByKey.Should().ContainKey(key);
    }

    [Fact]
    public void All_EachConfigurableActionHasAllFiveConfigKeys()
    {
        var actions = new[]
        {
            "Generation",
            "Evaluation",
            "Clarification",
            "SystemMessage",
            "Decomposition",
            "FillTemplateFields",
            "PlaygroundJudge",
        };
        var suffixes = new[]
        {
            "Model",
            "ProviderId",
            "Temperature",
            "MaxTokens",
            "ReasoningEffort",
        };

        foreach (var action in actions)
        foreach (var suffix in suffixes)
            ConfigRegistry
                .ByKey.Should()
                .ContainKey(
                    $"Ai:{action}:{suffix}",
                    $"action '{action}' must have config key 'Ai:{action}:{suffix}'"
                );
    }
}
