namespace Clarive.Domain.Entities;

public class McpServer : ITenantScoped
{
    public Guid Id { get; set; }
    public Guid TenantId { get; set; }
    public string Name { get; set; } = "";
    public string Url { get; set; } = "";
    public string? BearerTokenEncrypted { get; set; }
    public bool IsActive { get; set; } = true;
    public DateTime? LastSyncedAt { get; set; }
    public DateTime? NextSyncAt { get; set; }
    public string? LastSyncError { get; set; }
    public int ToolCount { get; set; }
    public DateTime CreatedAt { get; set; }
    public DateTime UpdatedAt { get; set; }
}
