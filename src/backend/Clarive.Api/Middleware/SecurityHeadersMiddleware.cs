namespace Clarive.Api.Middleware;

public class SecurityHeadersMiddleware(RequestDelegate next)
{
    public async Task InvokeAsync(HttpContext context)
    {
        context.Response.OnStarting(() =>
        {
            var headers = context.Response.Headers;
            headers["X-Content-Type-Options"] = "nosniff";
            headers["X-Frame-Options"] = "DENY";
            headers["Referrer-Policy"] = "strict-origin-when-cross-origin";
            headers["X-XSS-Protection"] = "0"; // Modern browsers: CSP replaces this; 0 avoids XSS auditor bugs
            headers["Permissions-Policy"] = "camera=(), microphone=(), geolocation=()";
            headers["Strict-Transport-Security"] = "max-age=31536000; includeSubDomains; preload";
            headers["Content-Security-Policy"] =
                "default-src 'self'; script-src 'self' 'wasm-unsafe-eval'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; connect-src 'self'; font-src 'self'; object-src 'none'; base-uri 'self'; form-action 'self'; frame-ancestors 'none';";
            return Task.CompletedTask;
        });

        await next(context);
    }
}
