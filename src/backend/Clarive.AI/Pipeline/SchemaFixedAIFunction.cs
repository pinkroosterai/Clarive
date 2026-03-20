using System.Text.Json;
using Microsoft.Extensions.AI;

namespace Clarive.AI.Pipeline;

/// <summary>
/// Wraps an AIFunction and overrides its JsonSchema with an OpenAI-compatible version.
/// Fixes issues like array properties missing "items" that OpenAI's API rejects.
/// </summary>
public sealed class SchemaFixedAIFunction : DelegatingAIFunction
{
    private readonly JsonElement _fixedSchema;

    public SchemaFixedAIFunction(AIFunction inner) : base(inner)
    {
        _fixedSchema = inner.JsonSchema.ValueKind != JsonValueKind.Undefined
            ? OpenAiSchemaFixer.Fix(inner.JsonSchema)
            : inner.JsonSchema;
    }

    public override JsonElement JsonSchema => _fixedSchema;
}
