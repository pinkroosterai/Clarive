using Clarive.Domain.Enums;
using Clarive.Api.Services;
using FluentAssertions;

namespace Clarive.Api.UnitTests.Services;

public class TemplateParserTests
{
    [Fact]
    public void Parse_SimpleStringVariable_ReturnsStringField()
    {
        var fields = TemplateParser.Parse("Hello {{name}}, welcome!");

        fields.Should().HaveCount(1);
        fields[0].Name.Should().Be("name");
        fields[0].Type.Should().Be(TemplateFieldType.String);
    }

    [Fact]
    public void Parse_TypedIntVariable_ReturnsIntFieldWithRange()
    {
        var fields = TemplateParser.Parse("Generate {{count|int:1-10}} items");

        fields.Should().HaveCount(1);
        fields[0].Name.Should().Be("count");
        fields[0].Type.Should().Be(TemplateFieldType.Int);
        fields[0].Min.Should().Be(1);
        fields[0].Max.Should().Be(10);
    }

    [Fact]
    public void Parse_TypedFloatVariable_ReturnsFloatFieldWithRange()
    {
        var fields = TemplateParser.Parse("Set temperature to {{temp|float:0-2}}");

        fields.Should().HaveCount(1);
        fields[0].Name.Should().Be("temp");
        fields[0].Type.Should().Be(TemplateFieldType.Float);
        fields[0].Min.Should().Be(0);
        fields[0].Max.Should().Be(2);
    }

    [Fact]
    public void Parse_EnumVariable_ReturnsEnumFieldWithValues()
    {
        var fields = TemplateParser.Parse("Use {{tone|enum:formal,casual,friendly}} tone");

        fields.Should().HaveCount(1);
        fields[0].Name.Should().Be("tone");
        fields[0].Type.Should().Be(TemplateFieldType.Enum);
        fields[0].EnumValues.Should().BeEquivalentTo(["formal", "casual", "friendly"]);
    }

    [Fact]
    public void Parse_MultipleVariables_ReturnsAll()
    {
        var fields = TemplateParser.Parse(
            "Hello {{name}}, you have {{count|int:1-100}} messages in {{lang|enum:en,fr}}"
        );

        fields.Should().HaveCount(3);
        fields[0].Name.Should().Be("name");
        fields[1].Name.Should().Be("count");
        fields[2].Name.Should().Be("lang");
    }

    [Fact]
    public void Parse_DuplicateVariables_DeduplicatesbyName()
    {
        var fields = TemplateParser.Parse("{{name}} and {{name}} again");

        fields.Should().HaveCount(1);
    }

    [Fact]
    public void Parse_NoVariables_ReturnsEmpty()
    {
        var fields = TemplateParser.Parse("No template variables here");

        fields.Should().BeEmpty();
    }

    [Fact]
    public void Parse_UnknownType_DefaultsToString()
    {
        var fields = TemplateParser.Parse("{{data|unknown}}");

        fields.Should().HaveCount(1);
        fields[0].Type.Should().Be(TemplateFieldType.String);
    }

    [Fact]
    public void Render_SubstitutesKnownValues()
    {
        var result = TemplateParser.Render(
            "Hello {{name}}, you are {{age|int:1-120}} years old",
            new Dictionary<string, string> { ["name"] = "Alice", ["age"] = "30" }
        );

        result.Should().Be("Hello Alice, you are 30 years old");
    }

    [Fact]
    public void Render_UnknownVariable_KeepsOriginal()
    {
        var result = TemplateParser.Render("Hello {{name}}", new Dictionary<string, string>());

        result.Should().Be("Hello {{name}}");
    }

    [Fact]
    public void Render_EmptyValue_KeepsOriginal()
    {
        var result = TemplateParser.Render(
            "Hello {{name}}",
            new Dictionary<string, string> { ["name"] = "" }
        );

        result.Should().Be("Hello {{name}}");
    }
}
