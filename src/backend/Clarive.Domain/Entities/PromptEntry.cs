using System.Text.Json.Serialization;

namespace Clarive.Domain.Entities;

public class PromptEntry : ITenantScoped
{
    public Guid Id { get; set; }
    public Guid TenantId { get; set; }
    public string Title { get; set; } = "";
    public Guid? FolderId { get; set; }
    public bool IsTrashed { get; set; }
    public DateTime? TrashedAt { get; set; }
    public Guid CreatedBy { get; set; }
    public DateTime CreatedAt { get; set; }
    public DateTime UpdatedAt { get; set; }

    // Concurrency token (PostgreSQL xmin system column)
    [JsonIgnore]
    public uint RowVersion { get; set; }

    // Navigation (excluded from JSON serialization to avoid cycles)
    [JsonIgnore]
    public Folder? Folder { get; set; }

    [JsonIgnore]
    public List<PromptEntryVersion> Versions { get; set; } = [];
}
