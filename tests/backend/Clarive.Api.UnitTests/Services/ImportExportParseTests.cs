using System.Reflection;
using Clarive.Api.Models.Entities;
using Clarive.Api.Services;
using FluentAssertions;

namespace Clarive.Api.UnitTests.Services;

public class ImportExportParseTests
{
    private static List<Prompt> ParseImportPrompts(Dictionary<object, object> raw)
    {
        var method = typeof(ImportExportService).GetMethod(
            "ParseImportPrompts",
            BindingFlags.NonPublic | BindingFlags.Static
        )!;
        return (List<Prompt>)method.Invoke(null, [raw])!;
    }

    [Fact]
    public void ParseImportPrompts_NoPromptsKey_ReturnsEmpty()
    {
        var raw = new Dictionary<object, object> { ["title"] = "Test" };
        ParseImportPrompts(raw).Should().BeEmpty();
    }

    [Fact]
    public void ParseImportPrompts_PromptsNotList_ReturnsEmpty()
    {
        var raw = new Dictionary<object, object> { ["prompts"] = "not a list" };
        ParseImportPrompts(raw).Should().BeEmpty();
    }

    [Fact]
    public void ParseImportPrompts_SinglePrompt_ParsesCorrectly()
    {
        var raw = new Dictionary<object, object>
        {
            ["prompts"] = new List<object>
            {
                new Dictionary<object, object>
                {
                    ["content"] = "Hello world",
                    ["isTemplate"] = "false",
                },
            },
        };

        var result = ParseImportPrompts(raw);

        result.Should().HaveCount(1);
        result[0].Content.Should().Be("Hello world");
        result[0].Order.Should().Be(0);
        result[0].IsTemplate.Should().BeFalse();
    }

    [Fact]
    public void ParseImportPrompts_TemplatePrompt_ParsesTemplateFields()
    {
        var raw = new Dictionary<object, object>
        {
            ["prompts"] = new List<object>
            {
                new Dictionary<object, object>
                {
                    ["content"] = "Hello {{name}}",
                    ["isTemplate"] = "true",
                },
            },
        };

        var result = ParseImportPrompts(raw);

        result[0].IsTemplate.Should().BeTrue();
        result[0].TemplateFields.Should().ContainSingle(f => f.Name == "name");
    }

    [Fact]
    public void ParseImportPrompts_MultiplePrompts_SetsOrderSequentially()
    {
        var raw = new Dictionary<object, object>
        {
            ["prompts"] = new List<object>
            {
                new Dictionary<object, object> { ["content"] = "First" },
                new Dictionary<object, object> { ["content"] = "Second" },
                new Dictionary<object, object> { ["content"] = "Third" },
            },
        };

        var result = ParseImportPrompts(raw);

        result.Should().HaveCount(3);
        result[0].Order.Should().Be(0);
        result[1].Order.Should().Be(1);
        result[2].Order.Should().Be(2);
    }

    [Fact]
    public void ParseImportPrompts_MissingContent_DefaultsToEmptyString()
    {
        var raw = new Dictionary<object, object>
        {
            ["prompts"] = new List<object>
            {
                new Dictionary<object, object> { ["isTemplate"] = "false" },
            },
        };

        var result = ParseImportPrompts(raw);

        result[0].Content.Should().BeEmpty();
    }

    [Fact]
    public void ParseImportPrompts_NonDictionaryItem_Skipped()
    {
        var raw = new Dictionary<object, object>
        {
            ["prompts"] = new List<object> { "not a dict", 42 },
        };

        ParseImportPrompts(raw).Should().BeEmpty();
    }

    [Fact]
    public void ParseImportPrompts_MissingIsTemplate_DefaultsFalse()
    {
        var raw = new Dictionary<object, object>
        {
            ["prompts"] = new List<object>
            {
                new Dictionary<object, object> { ["content"] = "Hello" },
            },
        };

        var result = ParseImportPrompts(raw);

        result[0].IsTemplate.Should().BeFalse();
        result[0].TemplateFields.Should().BeEmpty();
    }
}
