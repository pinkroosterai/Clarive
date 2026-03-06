using Clarive.Api.Models.Enums;

namespace Clarive.Api.Models.Entities;

public class TenantMembership : ITenantScoped
{
    public Guid Id { get; set; }
    public Guid UserId { get; set; }
    public Guid TenantId { get; set; }
    public UserRole Role { get; set; }
    public bool IsPersonal { get; set; }
    public DateTime JoinedAt { get; set; }
}
