using System.Text.Json.Nodes;

namespace Clarive.Api.Models.Entities;

public class ToolDescription : ITenantScoped
{
    public Guid Id { get; set; }
    public Guid TenantId { get; set; }
    public string Name { get; set; } = "";
    public string ToolName { get; set; } = "";
    public string Description { get; set; } = "";
    public JsonNode? InputSchema { get; set; }
    public DateTime CreatedAt { get; set; }
}
