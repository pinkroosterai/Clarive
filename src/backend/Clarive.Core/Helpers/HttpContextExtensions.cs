using Microsoft.AspNetCore.Http;
using System.Security.Claims;

namespace Clarive.Core.Helpers;

public static class HttpContextExtensions
{
    public static Guid GetTenantId(this HttpContext ctx) =>
        Guid.Parse(
            ctx.User.FindFirstValue("tenantId")
                ?? throw new InvalidOperationException("Missing 'tenantId' claim.")
        );

    public static Guid GetUserId(this HttpContext ctx) =>
        Guid.Parse(
            ctx.User.FindFirstValue(ClaimTypes.NameIdentifier)
                ?? throw new InvalidOperationException("Missing NameIdentifier claim.")
        );

    public static string GetUserName(this HttpContext ctx) =>
        ctx.User.FindFirstValue(ClaimTypes.Name)
        ?? throw new InvalidOperationException("Missing Name claim.");

    public static bool IsSuperUser(this HttpContext ctx) =>
        ctx.User.FindFirstValue("superUser") == "true";
}
