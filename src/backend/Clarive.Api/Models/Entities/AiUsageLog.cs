using Clarive.Api.Models.Enums;

namespace Clarive.Api.Models.Entities;

public class AiUsageLog : ITenantScoped
{
    public Guid Id { get; set; }
    public Guid TenantId { get; set; }
    public Guid UserId { get; set; }
    public AiActionType ActionType { get; set; }
    public string Model { get; set; } = "";
    public string Provider { get; set; } = "";
    public long InputTokens { get; set; }
    public long OutputTokens { get; set; }
    public decimal? EstimatedInputCostUsd { get; set; }
    public decimal? EstimatedOutputCostUsd { get; set; }
    public long DurationMs { get; set; }
    public Guid? EntryId { get; set; }
    public DateTime CreatedAt { get; set; }

    public PromptEntry? Entry { get; set; }
}
