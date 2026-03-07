using Clarive.Api.Middleware;
using FluentAssertions;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.TestHost;
using Microsoft.Extensions.Hosting;

namespace Clarive.Api.UnitTests.Middleware;

public class SecurityHeadersMiddlewareTests : IAsyncDisposable
{
    private readonly IHost _host;
    private readonly HttpClient _client;

    public SecurityHeadersMiddlewareTests()
    {
        _host = new HostBuilder()
            .ConfigureWebHost(builder =>
            {
                builder.UseTestServer();
                builder.Configure(app =>
                {
                    app.UseMiddleware<SecurityHeadersMiddleware>();
                    app.Run(ctx =>
                    {
                        ctx.Response.StatusCode = 200;
                        return Task.CompletedTask;
                    });
                });
            })
            .Build();

        _host.Start();
        _client = _host.GetTestClient();
    }

    public async ValueTask DisposeAsync()
    {
        _client.Dispose();
        await _host.StopAsync();
        _host.Dispose();
    }

    private static string? GetHeader(HttpResponseMessage response, string name)
    {
        if (response.Headers.TryGetValues(name, out var values))
            return string.Join(", ", values);
        if (response.Content.Headers.TryGetValues(name, out var contentValues))
            return string.Join(", ", contentValues);
        return null;
    }

    [Theory]
    [InlineData("X-Content-Type-Options", "nosniff")]
    [InlineData("X-Frame-Options", "DENY")]
    [InlineData("Referrer-Policy", "strict-origin-when-cross-origin")]
    [InlineData("X-XSS-Protection", "0")]
    public async Task Response_ContainsSecurityHeader(string headerName, string expectedValue)
    {
        var response = await _client.GetAsync("/test");
        GetHeader(response, headerName).Should().Be(expectedValue);
    }

    [Theory]
    [InlineData("Permissions-Policy", "camera=()")]
    [InlineData("Strict-Transport-Security", "max-age=")]
    [InlineData("Content-Security-Policy", "default-src 'self'")]
    public async Task Response_ContainsSecurityHeaderSubstring(string headerName, string expectedSubstring)
    {
        var response = await _client.GetAsync("/test");
        GetHeader(response, headerName).Should().Contain(expectedSubstring);
    }

    [Fact]
    public async Task Response_Returns200()
    {
        var response = await _client.GetAsync("/test");
        response.StatusCode.Should().Be(System.Net.HttpStatusCode.OK);
    }
}
