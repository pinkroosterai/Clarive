using System.Text.Json;
using System.Text.Json.Nodes;
using Clarive.AI.Models;
using FluentAssertions;
using Microsoft.Extensions.AI;

namespace Clarive.Api.UnitTests.Services;

/// <summary>
/// Guards the wire shapes sent as structured-output schemas. Strict providers reject a schema
/// whose <c>required</c> lists a key absent from <c>properties</c> (which is what an open
/// dictionary produces), so every evaluation response type must describe each dimension as a
/// fixed property.
/// </summary>
public class EvaluationSchemaTests
{
    [Theory]
    [InlineData(typeof(PromptEvaluationResponse), new[] { "clarity", "effectiveness", "completeness", "faithfulness" })]
    [InlineData(typeof(OutputEvaluationResponse), new[] { "accuracy", "helpfulness", "relevance", "coherence", "safety" })]
    public void ResponseSchema_HasOneFixedPropertyPerDimension(Type type, string[] dimensions)
    {
        var schema = JsonNode.Parse(AIJsonUtilities.CreateJsonSchema(type).GetRawText())!.AsObject();

        var properties = schema["properties"]!.AsObject();
        properties.Select(p => p.Key).Should().BeEquivalentTo(dimensions);
        foreach (var name in dimensions)
        {
            var dimension = properties[name]!.AsObject();
            dimension["properties"]!.AsObject().Select(p => p.Key).Should().BeEquivalentTo(["score", "feedback"]);
        }

        AssertRequiredKeysAreProperties(schema);
    }

    private static void AssertRequiredKeysAreProperties(JsonObject node)
    {
        if (node["required"] is JsonArray required)
        {
            var properties = node["properties"]?.AsObject().Select(p => p.Key).ToHashSet() ?? [];
            foreach (var key in required)
                properties.Should().Contain(key!.GetValue<string>(), because: "strict mode rejects required keys that are not properties");
        }

        foreach (var child in node)
        {
            if (child.Value is JsonObject obj)
                AssertRequiredKeysAreProperties(obj);
        }
    }
}
