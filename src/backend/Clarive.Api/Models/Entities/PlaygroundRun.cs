using System.ComponentModel.DataAnnotations.Schema;

namespace Clarive.Api.Models.Entities;

public class PlaygroundRun : ITenantScoped
{
    public Guid Id { get; set; }
    public Guid TenantId { get; set; }
    public Guid EntryId { get; set; }
    public Guid UserId { get; set; }
    public string Model { get; set; } = "";
    public float Temperature { get; set; }
    public int MaxTokens { get; set; }

    [Column(TypeName = "jsonb")]
    public string? TemplateFieldValues { get; set; }

    [Column(TypeName = "jsonb")]
    public string Responses { get; set; } = "[]";

    public DateTime CreatedAt { get; set; }

    public PromptEntry Entry { get; set; } = null!;
}
