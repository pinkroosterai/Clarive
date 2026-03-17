namespace Clarive.Api.Helpers;

/// <summary>
/// Endpoint filter that adds Cache-Control response headers to GET endpoints.
/// Uses 'private' directive to prevent shared/proxy caching of tenant-specific data.
/// </summary>
public class CacheControlFilter(int maxAgeSeconds) : IEndpointFilter
{
    public async ValueTask<object?> InvokeAsync(
        EndpointFilterInvocationContext context,
        EndpointFilterDelegate next)
    {
        var result = await next(context);
        context.HttpContext.Response.Headers.CacheControl =
            $"private, max-age={maxAgeSeconds}, must-revalidate";
        return result;
    }
}
