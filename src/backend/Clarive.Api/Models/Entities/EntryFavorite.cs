namespace Clarive.Api.Models.Entities;

public class EntryFavorite : ITenantScoped
{
    public Guid Id { get; set; }
    public Guid TenantId { get; set; }
    public Guid UserId { get; set; }
    public Guid EntryId { get; set; }
    public DateTime CreatedAt { get; set; }
}
