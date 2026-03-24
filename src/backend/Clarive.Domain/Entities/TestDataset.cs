using System.Text.Json.Serialization;

namespace Clarive.Domain.Entities;

public class TestDataset : ITenantScoped
{
    public Guid Id { get; set; }
    public Guid TenantId { get; set; }
    public Guid EntryId { get; set; }
    public string Name { get; set; } = "";
    public DateTime CreatedAt { get; set; }
    public DateTime UpdatedAt { get; set; }

    // Navigation
    [JsonIgnore]
    public PromptEntry Entry { get; set; } = null!;

    [JsonIgnore]
    public List<TestDatasetRow> Rows { get; set; } = [];
}
