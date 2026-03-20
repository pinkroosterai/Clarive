namespace Clarive.Domain.Interfaces;

public interface ITenantProvider
{
    Guid? TenantId { get; }
}
