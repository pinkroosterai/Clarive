using System.Text.RegularExpressions;
using Clarive.Domain.Entities;
using Clarive.Domain.Enums;

namespace Clarive.Application.Common;

public static partial class TemplateParser
{
    [GeneratedRegex(@"\{\{(\w+)(?:\|(\w+)(?::([^}]+))?)?\}\}")]
    private static partial Regex TagRegex();

    public static List<TemplateField> Parse(string content)
    {
        var seen = new HashSet<string>();
        var fields = new List<TemplateField>();

        foreach (Match match in TagRegex().Matches(content))
        {
            var name = match.Groups[1].Value;
            if (!seen.Add(name))
                continue;

            var rawType = match.Groups[2].Success ? match.Groups[2].Value : "string";
            var options = match.Groups[3].Success ? match.Groups[3].Value : "";

            var type = rawType switch
            {
                "int" => TemplateFieldType.Int,
                "float" => TemplateFieldType.Float,
                "enum" => TemplateFieldType.Enum,
                _ => TemplateFieldType.String,
            };

            var field = new TemplateField { Name = name, Type = type };

            if (
                type is TemplateFieldType.Int or TemplateFieldType.Float
                && !string.IsNullOrEmpty(options)
            )
            {
                var parts = options.Split('-');
                if (
                    parts.Length == 2
                    && double.TryParse(parts[0], out var min)
                    && double.TryParse(parts[1], out var max)
                )
                {
                    field.Min = min;
                    field.Max = max;
                }
            }

            if (type == TemplateFieldType.Enum && !string.IsNullOrEmpty(options))
            {
                field.EnumValues = options
                    .Split(',')
                    .Select(v => v.Trim())
                    .Where(v => v.Length > 0)
                    .ToList();
            }

            fields.Add(field);
        }

        return fields;
    }

    public static string Render(string content, Dictionary<string, string> values)
    {
        return TagRegex()
            .Replace(
                content,
                match =>
                {
                    var name = match.Groups[1].Value;
                    return values.TryGetValue(name, out var value) && !string.IsNullOrEmpty(value)
                        ? value
                        : match.Value;
                }
            );
    }
}
