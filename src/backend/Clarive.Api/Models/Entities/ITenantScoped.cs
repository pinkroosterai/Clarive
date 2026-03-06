namespace Clarive.Api.Models.Entities;

public interface ITenantScoped
{
    Guid TenantId { get; set; }
}
