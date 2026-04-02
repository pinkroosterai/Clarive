using Clarive.Domain.Enums;

namespace Clarive.Domain.Entities;

public class AiProvider
{
    public Guid Id { get; set; }
    public string Name { get; set; } = "";
    public string? EndpointUrl { get; set; }
    public string ApiKeyEncrypted { get; set; } = "";
    public bool IsActive { get; set; } = true;
    public AiApiMode ApiMode { get; set; }
    public Dictionary<string, string>? CustomHeaders { get; set; }
    public bool UseProviderPricing { get; set; }
    public int SortOrder { get; set; }
    public DateTime CreatedAt { get; set; }
    public DateTime UpdatedAt { get; set; }

    public List<AiProviderModel> Models { get; set; } = [];
}
