using Clarive.Api.Models.Agents;
using Clarive.Api.Models.Requests;

namespace Clarive.Api.Models.Entities;

public class AiSession : ITenantScoped
{
    public Guid Id { get; set; }
    public Guid TenantId { get; set; }
    public CreateEntryRequest Draft { get; set; } = null!;
    public List<ClarificationQuestion> Questions { get; set; } = [];
    public List<string> Enhancements { get; set; } = [];
    public List<IterationScore> ScoreHistory { get; set; } = [];
    public GenerationConfig? Config { get; set; }
    public string? AgentSessionId { get; set; }
    public DateTime CreatedAt { get; set; }
}
