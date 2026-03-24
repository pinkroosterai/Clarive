using System.Text.Json.Serialization;

namespace Clarive.Domain.Entities;

public class TestDatasetRow
{
    public Guid Id { get; set; }
    public Guid DatasetId { get; set; }
    public Dictionary<string, string> Values { get; set; } = new();
    public DateTime CreatedAt { get; set; }

    // Navigation
    [JsonIgnore]
    public TestDataset Dataset { get; set; } = null!;
}
