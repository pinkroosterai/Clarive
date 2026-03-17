namespace Clarive.Api.Models.Entities;

public class ShareLink : ITenantScoped
{
    public Guid Id { get; set; }
    public Guid TenantId { get; set; }
    public Guid EntryId { get; set; }
    public string TokenHash { get; set; } = "";
    public Guid CreatedBy { get; set; }
    public DateTime CreatedAt { get; set; }
    public DateTime? ExpiresAt { get; set; }
    public string? PasswordHash { get; set; }
    public int? PinnedVersion { get; set; }
    public int AccessCount { get; set; }
    public bool IsActive { get; set; } = true;
}
