using System.Text.Json.Serialization;

namespace Clarive.Domain.Entities;

public class Prompt
{
    public Guid Id { get; set; }
    public Guid VersionId { get; set; }
    public string Content { get; set; } = "";
    public int Order { get; set; }
    public bool IsTemplate { get; set; }
    public List<TemplateField> TemplateFields { get; set; } = [];

    // Navigation (excluded from JSON serialization to avoid cycles)
    [JsonIgnore]
    public PromptEntryVersion Version { get; set; } = null!;
}
