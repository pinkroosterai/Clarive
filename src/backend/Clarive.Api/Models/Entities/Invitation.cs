using Clarive.Api.Models.Enums;

namespace Clarive.Api.Models.Entities;

public class Invitation : ITenantScoped
{
    public Guid Id { get; set; }
    public Guid TenantId { get; set; }
    public string Email { get; set; } = "";
    public UserRole Role { get; set; }
    public string TokenHash { get; set; } = "";
    public Guid InvitedById { get; set; }
    public Guid? TargetUserId { get; set; }
    public DateTime ExpiresAt { get; set; }
    public DateTime CreatedAt { get; set; }
}
