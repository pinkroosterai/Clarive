using System.Text.Json;

namespace Clarive.AI.Pipeline;

/// <summary>
/// Fixes JSON Schemas from MCP tools to be compatible with OpenAI's strict requirements.
/// OpenAI rejects array properties that lack an "items" field, even though standard JSON Schema
/// considers it optional. This fixer adds { "type": "string" } as default items for any
/// array property missing it.
/// </summary>
public static class OpenAiSchemaFixer
{
    /// <summary>
    /// Recursively fixes a JSON Schema element so that all array-type properties
    /// include an "items" field, which OpenAI requires.
    /// </summary>
    public static JsonElement Fix(JsonElement schema)
    {
        using var doc = JsonDocument.Parse(FixNode(schema).GetRawText());
        return doc.RootElement.Clone();
    }

    private static JsonElement FixNode(JsonElement node)
    {
        if (node.ValueKind != JsonValueKind.Object)
            return node;

        using var ms = new MemoryStream();
        using (var writer = new Utf8JsonWriter(ms))
        {
            writer.WriteStartObject();

            var needsItems = false;
            var hasItems = false;

            // Check if this is an array type that needs items
            if (node.TryGetProperty("type", out var typeProp))
            {
                if (typeProp.ValueKind == JsonValueKind.String && typeProp.GetString() == "array")
                    needsItems = true;
            }

            if (node.TryGetProperty("items", out _))
                hasItems = true;

            foreach (var prop in node.EnumerateObject())
            {
                writer.WritePropertyName(prop.Name);

                if (prop.Name == "properties" && prop.Value.ValueKind == JsonValueKind.Object)
                {
                    // Recurse into properties
                    writer.WriteStartObject();
                    foreach (var innerProp in prop.Value.EnumerateObject())
                    {
                        writer.WritePropertyName(innerProp.Name);
                        var fixed_ = FixNode(innerProp.Value);
                        fixed_.WriteTo(writer);
                    }
                    writer.WriteEndObject();
                }
                else if (prop.Name == "items" && prop.Value.ValueKind == JsonValueKind.Object)
                {
                    // Recurse into items
                    var fixed_ = FixNode(prop.Value);
                    fixed_.WriteTo(writer);
                }
                else
                {
                    prop.Value.WriteTo(writer);
                }
            }

            // Add missing items for array types
            if (needsItems && !hasItems)
            {
                writer.WritePropertyName("items");
                writer.WriteStartObject();
                writer.WriteString("type", "string");
                writer.WriteEndObject();
            }

            writer.WriteEndObject();
        }

        ms.Position = 0;
        using var resultDoc = JsonDocument.Parse(ms);
        return resultDoc.RootElement.Clone();
    }
}
