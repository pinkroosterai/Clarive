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
            request.Headers.TryAddWithoutValidation(key, value);
        }

        return base.SendAsync(request, cancellationToken);
    }
}
