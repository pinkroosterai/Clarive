namespace Clarive.Api.Models.Entities;

public class AiProvider
{
    public Guid Id { get; set; }
    public string Name { get; set; } = "";
    public string? EndpointUrl { get; set; }
    public string ApiKeyEncrypted { get; set; } = "";
    public bool IsActive { get; set; } = true;
    public int SortOrder { get; set; }
    public DateTime CreatedAt { get; set; }
    public DateTime UpdatedAt { get; set; }

    public List<AiProviderModel> Models { get; set; } = [];
}
