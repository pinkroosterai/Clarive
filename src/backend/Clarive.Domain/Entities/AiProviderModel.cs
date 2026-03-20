namespace Clarive.Domain.Entities;

public class AiProviderModel
{
    public Guid Id { get; set; }
    public Guid ProviderId { get; set; }
    public string ModelId { get; set; } = "";
    public string? DisplayName { get; set; }
    public bool IsReasoning { get; set; }
    public bool SupportsFunctionCalling { get; set; }
    public bool SupportsResponseSchema { get; set; }
    public long? MaxInputTokens { get; set; }
    public long? MaxOutputTokens { get; set; }

    public float? DefaultTemperature { get; set; }
    public int? DefaultMaxTokens { get; set; }
    public string? DefaultReasoningEffort { get; set; }
    public decimal? InputCostPerMillion { get; set; }
    public decimal? OutputCostPerMillion { get; set; }
    public bool HasManualCostOverride { get; set; }
    public bool IsActive { get; set; } = true;
    public int SortOrder { get; set; }

    public AiProvider Provider { get; set; } = null!;
}
