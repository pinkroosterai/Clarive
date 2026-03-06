using System.Security.Claims;
using Microsoft.AspNetCore.Http;

namespace Clarive.Api.Auth;

public class HttpContextTenantProvider(IHttpContextAccessor httpContextAccessor) : ITenantProvider
{
    public Guid? TenantId
    {
        get
        {
            var claim = httpContextAccessor.HttpContext?.User.FindFirstValue("tenantId");
            return claim is not null && Guid.TryParse(claim, out var id) ? id : null;
        }
    }
}
