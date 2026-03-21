using System.Text.Json.Serialization;

namespace Clarive.Domain.Entities;

public class Folder : ITenantScoped
{
    public Guid Id { get; set; }
    public Guid TenantId { get; set; }
    public string Name { get; set; } = "";
    public Guid? ParentId { get; set; }
    public string? Color { get; set; }
    public DateTime CreatedAt { get; set; }

    // Navigation (excluded from JSON serialization to avoid cycles)
    [JsonIgnore]
    public Folder? Parent { get; set; }

    [JsonIgnore]
    public List<Folder> Children { get; set; } = [];
}
