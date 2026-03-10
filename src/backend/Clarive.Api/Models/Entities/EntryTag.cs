namespace Clarive.Api.Models.Entities;

public class EntryTag : ITenantScoped
{
    public Guid Id { get; set; }
    public Guid TenantId { get; set; }
    public Guid EntryId { get; set; }
    public string TagName { get; set; } = "";
    public DateTime CreatedAt { get; set; }
}
