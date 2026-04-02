using Clarive.AI.Agents;
using FluentAssertions;

namespace Clarive.Api.UnitTests.Services;

public class CustomHeadersHandlerTests
{
    [Fact]
    public async Task SendAsync_WithHeaders_InjectsAllHeaders()
    {
        var headers = new Dictionary<string, string>
        {
            ["X-Custom-One"] = "value1",
            ["X-Custom-Two"] = "value2",
        };

        var captured = new HttpRequestMessage();
        var innerHandler = new CapturingHandler(captured);
        var handler = new CustomHeadersHandler(headers) { InnerHandler = innerHandler };
        using var client = new HttpClient(handler);

        await client.GetAsync("http://localhost/test");

        captured.Headers.GetValues("X-Custom-One").Should().ContainSingle("value1");
        captured.Headers.GetValues("X-Custom-Two").Should().ContainSingle("value2");
    }

    [Fact]
    public async Task SendAsync_EmptyHeaders_NoHeadersAdded()
    {
        var headers = new Dictionary<string, string>();

        var captured = new HttpRequestMessage();
        var innerHandler = new CapturingHandler(captured);
        var handler = new CustomHeadersHandler(headers) { InnerHandler = innerHandler };
        using var client = new HttpClient(handler);

        await client.GetAsync("http://localhost/test");

        // Only default headers should exist (Host, etc.)
        captured.Headers.Should().NotContain(h => h.Key.StartsWith("X-Custom"));
    }

    [Fact]
    public async Task SendAsync_HeadersWithSpecialCharacters_UsedViaTryAddWithoutValidation()
    {
        // HTTP-Referer with URL value would fail strict validation with Add()
        var headers = new Dictionary<string, string>
        {
            ["HTTP-Referer"] = "https://app.example.com/dashboard",
            ["X-OpenRouter-Title"] = "Clarive",
        };

        var captured = new HttpRequestMessage();
        var innerHandler = new CapturingHandler(captured);
        var handler = new CustomHeadersHandler(headers) { InnerHandler = innerHandler };
        using var client = new HttpClient(handler);

        await client.GetAsync("http://localhost/test");

        captured.Headers.GetValues("HTTP-Referer").Should().ContainSingle("https://app.example.com/dashboard");
        captured.Headers.GetValues("X-OpenRouter-Title").Should().ContainSingle("Clarive");
    }

    private class CapturingHandler : HttpMessageHandler
    {
        private readonly HttpRequestMessage _capture;

        public CapturingHandler(HttpRequestMessage capture)
        {
            _capture = capture;
        }

        protected override Task<HttpResponseMessage> SendAsync(
            HttpRequestMessage request,
            CancellationToken cancellationToken
        )
        {
            // Copy headers from the request to the capture object
            foreach (var header in request.Headers)
            {
                _capture.Headers.TryAddWithoutValidation(header.Key, header.Value);
            }

            return Task.FromResult(new HttpResponseMessage(System.Net.HttpStatusCode.OK));
        }
    }
}
