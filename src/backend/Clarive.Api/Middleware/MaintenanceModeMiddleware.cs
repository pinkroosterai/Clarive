using System.IdentityModel.Tokens.Jwt;
using Clarive.Core.Services;

namespace Clarive.Api.Middleware;

public class MaintenanceModeMiddleware(
    RequestDelegate next,
    IMaintenanceModeService maintenanceMode,
    ILogger<MaintenanceModeMiddleware> logger
)
{
    // Exact paths that are exempt from maintenance mode
    private static readonly string[] ExemptExactPaths =
    [
        "/api/auth/login",
        "/api/auth/refresh",
        "/api/auth/google",
        "/api/status",
    ];

    // Prefix paths that are exempt (path must equal or continue with '/')
    private static readonly string[] ExemptPrefixes = ["/healthz", "/api/super"];

    public async Task InvokeAsync(HttpContext context)
    {
        if (!maintenanceMode.IsEnabled)
        {
            await next(context);
            return;
        }

        var path = context.Request.Path.Value ?? "";

        // Always allow exempt paths
        if (IsExemptPath(path))
        {
            await next(context);
            return;
        }

        // Check if request has a super user JWT (pre-auth: read without validation)
        if (IsSuperUserToken(context))
        {
            context.Response.Headers["X-Maintenance-Mode"] = "true";
            await next(context);
            return;
        }

        // Block everyone else with 503
        context.Response.StatusCode = 503;
        context.Response.ContentType = "application/json";
        context.Response.Headers["Retry-After"] = "60";
        await context.Response.WriteAsJsonAsync(
            new
            {
                error = new
                {
                    code = "MAINTENANCE_MODE",
                    message = "Clarive is currently undergoing maintenance. Please try again later.",
                },
            }
        );
    }

    private static bool IsExemptPath(string path)
    {
        foreach (var exact in ExemptExactPaths)
        {
            if (path.Equals(exact, StringComparison.OrdinalIgnoreCase))
                return true;
        }

        foreach (var prefix in ExemptPrefixes)
        {
            if (
                path.Equals(prefix, StringComparison.OrdinalIgnoreCase)
                || path.StartsWith(prefix + "/", StringComparison.OrdinalIgnoreCase)
            )
                return true;
        }

        return false;
    }

    private bool IsSuperUserToken(HttpContext context)
    {
        var authHeader = context.Request.Headers.Authorization.FirstOrDefault();
        if (
            authHeader is null
            || !authHeader.StartsWith("Bearer ", StringComparison.OrdinalIgnoreCase)
        )
            return false;

        var token = authHeader["Bearer ".Length..];
        try
        {
            var handler = new JwtSecurityTokenHandler();
            var jwt = handler.ReadJwtToken(token);
            return jwt.Claims.Any(c => c.Type == "superUser" && c.Value == "true");
        }
        catch (Exception ex)
        {
            logger.LogDebug(ex, "Failed to read JWT for super user check during maintenance mode");
            return false;
        }
    }
}
