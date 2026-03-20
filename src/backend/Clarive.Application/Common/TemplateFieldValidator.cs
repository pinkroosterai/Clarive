using Clarive.Domain.Entities;
using Clarive.Domain.Enums;

namespace Clarive.Application.Common;

public static class TemplateFieldValidator
{
    private const int MaxFieldValueLength = 10_000;

    public static Dictionary<string, string> ValidateFields(
        List<TemplateField> definitions,
        Dictionary<string, string> values
    )
    {
        var errors = new Dictionary<string, string>();

        foreach (var field in definitions)
        {
            if (!values.TryGetValue(field.Name, out var value) || string.IsNullOrEmpty(value))
            {
                errors[field.Name] = $"Field '{field.Name}' is required.";
                continue;
            }

            if (value.Length > MaxFieldValueLength)
            {
                errors[field.Name] =
                    $"Field '{field.Name}' exceeds maximum length of {MaxFieldValueLength} characters.";
                continue;
            }

            var error = field.Type switch
            {
                TemplateFieldType.Int => ValidateNumeric<int>(field, value, int.TryParse),
                TemplateFieldType.Float => ValidateNumeric<double>(field, value, double.TryParse),
                TemplateFieldType.Enum => field.EnumValues is { Count: > 0 }
                && !field.EnumValues.Contains(value, StringComparer.OrdinalIgnoreCase)
                    ? $"Field '{field.Name}' must be one of: {string.Join(", ", field.EnumValues)}."
                    : null,
                _ => null,
            };

            if (error is not null)
                errors[field.Name] = error;
        }

        return errors;
    }

    /// <summary>
    /// Filters a field values dictionary to only include keys that match defined template fields.
    /// Prevents storage of arbitrary extra data.
    /// </summary>
    public static Dictionary<string, string> FilterToDefinedFields(
        List<TemplateField> definitions,
        Dictionary<string, string> values
    )
    {
        var definedNames = new HashSet<string>(definitions.Select(f => f.Name));
        return values
            .Where(kv => definedNames.Contains(kv.Key))
            .ToDictionary(kv => kv.Key, kv => kv.Value);
    }

    private delegate bool TryParseDelegate<T>(string input, out T result);

    private static string? ValidateNumeric<T>(
        TemplateField field,
        string value,
        TryParseDelegate<T> tryParse
    )
        where T : IComparable<T>
    {
        if (!tryParse(value, out var parsed))
            return $"Field '{field.Name}' must be {(typeof(T) == typeof(int) ? "an integer" : "a number")}.";

        var numericVal = Convert.ToDouble(parsed);
        if (field.Min.HasValue && numericVal < field.Min.Value)
            return $"Field '{field.Name}' must be >= {field.Min.Value}.";
        if (field.Max.HasValue && numericVal > field.Max.Value)
            return $"Field '{field.Name}' must be <= {field.Max.Value}.";

        return null;
    }
}
