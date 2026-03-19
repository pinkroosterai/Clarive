using Clarive.Api.Models.Enums;

namespace Clarive.Api.Models.Entities;

public class User : ITenantScoped
{
    public Guid Id { get; set; }
    public Guid TenantId { get; set; }
    public string Email { get; set; } = "";
    public string Name { get; set; } = "";
    public string? PasswordHash { get; set; }
    public UserRole Role { get; set; }
    public DateTime CreatedAt { get; set; }
    public bool EmailVerified { get; set; }
    public string? GoogleId { get; set; }
    public DateTime? DeletedAt { get; set; }
    public DateTime? DeleteScheduledAt { get; set; }
    public bool OnboardingCompleted { get; set; }
    public string? AvatarPath { get; set; }
    public bool IsSuperUser { get; set; }
    public string? ThemePreference { get; set; }
}
