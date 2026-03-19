using Clarive.Api.Models.Enums;

namespace Clarive.Api.Models.Entities;

public class TemplateField
{
    public Guid Id { get; set; }
    public Guid PromptId { get; set; }
    public string Name { get; set; } = "";
    public TemplateFieldType Type { get; set; }
    public List<string>? EnumValues { get; set; }
    public string? DefaultValue { get; set; }
    public double? Min { get; set; }
    public double? Max { get; set; }
}
