namespace Clarive.Api.Auth;

public interface ITenantProvider
{
    Guid? TenantId { get; }
}
