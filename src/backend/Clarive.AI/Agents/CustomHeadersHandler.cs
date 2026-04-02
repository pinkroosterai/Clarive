namespace Clarive.AI.Agents;

public class CustomHeadersHandler(Dictionary<string, string> headers) : DelegatingHandler(new HttpClientHandler())
{
    protected override Task<HttpResponseMessage> SendAsync(
        HttpRequestMessage request,
        CancellationToken cancellationToken
    )
    {
        foreach (var (key, value) in headers)
        {
            if (ContainsCrlf(key) || ContainsCrlf(value))
                continue;

            request.Headers.TryAddWithoutValidation(key, value);
        }

        return base.SendAsync(request, cancellationToken);
    }

    private static bool ContainsCrlf(string value) =>
        value.Contains('\r') || value.Contains('\n');
}
