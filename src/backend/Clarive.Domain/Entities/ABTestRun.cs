using System.Text.Json.Serialization;
using Clarive.Domain.Enums;

namespace Clarive.Domain.Entities;

public class ABTestRun : ITenantScoped
{
    public Guid Id { get; set; }
    public Guid TenantId { get; set; }
    public Guid EntryId { get; set; }
    public Guid? UserId { get; set; }
    public int VersionANumber { get; set; }
    public int VersionBNumber { get; set; }
    public Guid? DatasetId { get; set; }
    public string Model { get; set; } = "";
    public float Temperature { get; set; }
    public int MaxTokens { get; set; }
    public ABTestStatus Status { get; set; }
    public DateTime CreatedAt { get; set; }
    public DateTime? CompletedAt { get; set; }

    // Navigation
    [JsonIgnore]
    public PromptEntry Entry { get; set; } = null!;

    [JsonIgnore]
    public TestDataset Dataset { get; set; } = null!;

    [JsonIgnore]
    public List<ABTestResult> Results { get; set; } = [];
}
