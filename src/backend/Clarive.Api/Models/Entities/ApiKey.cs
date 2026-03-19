namespace Clarive.Api.Models.Entities;

public class ApiKey : ITenantScoped
{
    public Guid Id { get; set; }
    public Guid TenantId { get; set; }
    public string Name { get; set; } = "";
    public string KeyHash { get; set; } = "";
    public string KeyPrefix { get; set; } = "";
    public DateTime CreatedAt { get; set; }
    public DateTime? ExpiresAt { get; set; }
    public DateTime? LastUsedAt { get; set; }
    public long UsageCount { get; set; }
}
