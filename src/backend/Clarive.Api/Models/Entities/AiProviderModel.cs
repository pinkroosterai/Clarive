namespace Clarive.Api.Models.Entities;

public class AiProviderModel
{
    public Guid Id { get; set; }
    public Guid ProviderId { get; set; }
    public string ModelId { get; set; } = "";
    public string? DisplayName { get; set; }
    public bool IsReasoning { get; set; }
    public int MaxContextSize { get; set; } = 128000;
    public bool IsTemperatureConfigurable { get; set; } = true;
    public bool IsActive { get; set; } = true;
    public int SortOrder { get; set; }

    public AiProvider Provider { get; set; } = null!;
}
