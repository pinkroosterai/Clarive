using Sentry;
using Sentry.Extensibility;

namespace Clarive.Api.Middleware;

/// <summary>
/// Removes sensitive headers from Sentry events to prevent JWT tokens
/// and API keys from being transmitted to Sentry.
/// </summary>
public class SentryPiiFilter : ISentryEventExceptionProcessor
{
    private static readonly HashSet<string> SensitiveHeaders = new(StringComparer.OrdinalIgnoreCase)
    {
        "Authorization",
        "X-Api-Key",
        "Cookie",
        "Set-Cookie"
    };

    public void Process(Exception exception, SentryEvent sentryEvent)
    {
        if (sentryEvent.Request?.Headers is not { } headers) return;

        foreach (var header in SensitiveHeaders)
            headers.Remove(header);
    }
}
