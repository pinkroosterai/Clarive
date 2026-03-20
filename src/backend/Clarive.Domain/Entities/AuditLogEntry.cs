using Clarive.Domain.Enums;

namespace Clarive.Domain.Entities;

public class AuditLogEntry : ITenantScoped
{
    public Guid Id { get; set; }
    public Guid TenantId { get; set; }
    public AuditAction Action { get; set; }
    public string EntityType { get; set; } = "";
    public Guid EntityId { get; set; }
    public string EntityTitle { get; set; } = "";
    public Guid UserId { get; set; }
    public string UserName { get; set; } = "";
    public DateTime Timestamp { get; set; }
    public string? Details { get; set; }
    public DateTime ExpiresAt { get; set; }
}
