using System.ComponentModel.DataAnnotations.Schema;

namespace Clarive.Domain.Entities;

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

    [Column(TypeName = "jsonb")]
    public string? JudgeScores { get; set; }

    [Column(TypeName = "jsonb")]
    public string? Reasoning { get; set; }

    public string? RenderedSystemMessage { get; set; }

    [Column(TypeName = "jsonb")]
    public string? RenderedPrompts { get; set; }

    [Column(TypeName = "jsonb")]
    public string? ToolInvocations { get; set; }

    [Column(TypeName = "jsonb")]
    public string? McpServerIds { get; set; }

    public int? VersionNumber { get; set; }
    public string? VersionLabel { get; set; }

    public DateTime CreatedAt { get; set; }

    public PromptEntry Entry { get; set; } = null!;
}
