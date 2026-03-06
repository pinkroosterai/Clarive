namespace Clarive.Api.Models.Entities;

public class Tenant
{
    public Guid Id { get; set; }
    public string Name { get; set; } = "";
    public DateTime CreatedAt { get; set; }

    public Guid? OwnerId { get; set; }
public DateTime? DeletedAt { get; set; }
    public DateTime? DeleteScheduledAt { get; set; }
    public string? AvatarPath { get; set; }

    // Navigation
    public List<User> Users { get; set; } = [];
    public List<Folder> Folders { get; set; } = [];
    public List<PromptEntry> Entries { get; set; } = [];
}
