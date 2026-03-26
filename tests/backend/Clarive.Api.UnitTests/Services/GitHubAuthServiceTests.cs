using System.Net;
using System.Text.Json;
using Clarive.Auth.GitHub;
using FluentAssertions;
using Microsoft.Extensions.Options;
using NSubstitute;

namespace Clarive.Api.UnitTests.Services;

public class GitHubAuthServiceTests
{
    private const string ClientId = "test-client-id";
    private const string ClientSecret = "test-client-secret";

    private static GitHubAuthService CreateService(
        params (HttpMethod Method, string UrlContains, HttpStatusCode Status, string Body)[] responses
    )
    {
        var handler = new FakeHttpMessageHandler(responses);
        var factory = Substitute.For<IHttpClientFactory>();
        factory.CreateClient("GitHub").Returns(_ =>
        {
            var client = new HttpClient(handler);
            client.DefaultRequestHeaders.Accept.Add(
                new System.Net.Http.Headers.MediaTypeWithQualityHeaderValue("application/json")
            );
            client.DefaultRequestHeaders.UserAgent.Add(
                new System.Net.Http.Headers.ProductInfoHeaderValue("Clarive", "1.0")
            );
            return client;
        });

        var settings = new GitHubAuthSettings { ClientId = ClientId, ClientSecret = ClientSecret };
        var optionsMonitor = Substitute.For<IOptionsMonitor<GitHubAuthSettings>>();
        optionsMonitor.CurrentValue.Returns(settings);

        return new GitHubAuthService(optionsMonitor, factory);
    }

    [Fact]
    public async Task ExchangeCodeForUserAsync_WithPublicEmail_ReturnsUserInfo()
    {
        var sut = CreateService(
            (HttpMethod.Post, "login/oauth/access_token", HttpStatusCode.OK,
                JsonSerializer.Serialize(new { access_token = "gho_abc123", token_type = "bearer", scope = "read:user,user:email" })),
            (HttpMethod.Get, "api.github.com/user", HttpStatusCode.OK,
                JsonSerializer.Serialize(new { id = 12345, login = "octocat", name = "The Octocat", email = "octocat@github.com", avatar_url = "https://avatars.githubusercontent.com/u/12345" }))
        );

        var result = await sut.ExchangeCodeForUserAsync("test-code", "http://localhost/callback");

        result.GitHubId.Should().Be("12345");
        result.Email.Should().Be("octocat@github.com");
        result.Name.Should().Be("The Octocat");
        result.AvatarUrl.Should().Be("https://avatars.githubusercontent.com/u/12345");
    }

    [Fact]
    public async Task ExchangeCodeForUserAsync_WithPrivateEmail_FallsBackToEmailsEndpoint()
    {
        var sut = CreateService(
            (HttpMethod.Post, "login/oauth/access_token", HttpStatusCode.OK,
                JsonSerializer.Serialize(new { access_token = "gho_abc123", token_type = "bearer", scope = "" })),
            (HttpMethod.Get, "api.github.com/user/emails", HttpStatusCode.OK,
                JsonSerializer.Serialize(new[]
                {
                    new { email = "noreply@github.com", primary = false, verified = true },
                    new { email = "real@example.com", primary = true, verified = true },
                })),
            (HttpMethod.Get, "api.github.com/user", HttpStatusCode.OK,
                JsonSerializer.Serialize(new { id = 99, login = "privateuser", name = "Private User", email = (string?)null, avatar_url = (string?)null }))
        );

        var result = await sut.ExchangeCodeForUserAsync("test-code", "http://localhost/callback");

        result.Email.Should().Be("real@example.com");
        result.Name.Should().Be("Private User");
    }

    [Fact]
    public async Task ExchangeCodeForUserAsync_WithNoName_FallsBackToLogin()
    {
        var sut = CreateService(
            (HttpMethod.Post, "login/oauth/access_token", HttpStatusCode.OK,
                JsonSerializer.Serialize(new { access_token = "gho_abc", token_type = "bearer", scope = "" })),
            (HttpMethod.Get, "api.github.com/user", HttpStatusCode.OK,
                JsonSerializer.Serialize(new { id = 1, login = "justlogin", name = (string?)null, email = "test@test.com", avatar_url = (string?)null }))
        );

        var result = await sut.ExchangeCodeForUserAsync("test-code", "http://localhost/callback");

        result.Name.Should().Be("justlogin");
    }

    [Fact]
    public async Task ExchangeCodeForUserAsync_WhenGitHubReturnsError_Throws()
    {
        var sut = CreateService(
            (HttpMethod.Post, "login/oauth/access_token", HttpStatusCode.OK,
                JsonSerializer.Serialize(new { error = "bad_verification_code", error_description = "The code is invalid." }))
        );

        var act = () => sut.ExchangeCodeForUserAsync("bad-code", "http://localhost/callback");

        await act.Should().ThrowAsync<InvalidOperationException>()
            .WithMessage("*bad_verification_code*");
    }

    [Fact]
    public async Task ExchangeCodeForUserAsync_WhenTokenRequestFails_Throws()
    {
        var sut = CreateService(
            (HttpMethod.Post, "login/oauth/access_token", HttpStatusCode.InternalServerError, "Server Error")
        );

        var act = () => sut.ExchangeCodeForUserAsync("test-code", "http://localhost/callback");

        await act.Should().ThrowAsync<HttpRequestException>();
    }

    [Fact]
    public void GetAuthorizationUrl_IncludesAllRequiredParams()
    {
        var sut = CreateService();

        var url = sut.GetAuthorizationUrl("http://localhost/callback", "random-state-token");

        url.Should().StartWith("https://github.com/login/oauth/authorize?");
        url.Should().Contain($"client_id={ClientId}");
        url.Should().Contain("redirect_uri=http%3A%2F%2Flocalhost%2Fcallback");
        url.Should().Contain("scope=read%3Auser%20user%3Aemail");
        url.Should().Contain("state=random-state-token");
    }

    [Fact]
    public void IsConfigured_WithClientId_ReturnsTrue()
    {
        var sut = CreateService();
        sut.IsConfigured.Should().BeTrue();
    }

    [Fact]
    public void IsConfigured_WithoutClientId_ReturnsFalse()
    {
        var optionsMonitor = Substitute.For<IOptionsMonitor<GitHubAuthSettings>>();
        optionsMonitor.CurrentValue.Returns(new GitHubAuthSettings());
        var factory = Substitute.For<IHttpClientFactory>();
        var sut = new GitHubAuthService(optionsMonitor, factory);

        sut.IsConfigured.Should().BeFalse();
    }

    /// <summary>
    /// Simple fake handler that matches responses by HTTP method and URL substring.
    /// </summary>
    private sealed class FakeHttpMessageHandler(
        (HttpMethod Method, string UrlContains, HttpStatusCode Status, string Body)[] responses
    ) : HttpMessageHandler
    {
        protected override Task<HttpResponseMessage> SendAsync(
            HttpRequestMessage request,
            CancellationToken cancellationToken
        )
        {
            // Match by method + longest URL substring match (most specific wins)
            var url = request.RequestUri?.ToString() ?? "";
            var bestMatch = responses
                .Where(r => r.Method == request.Method
                    && url.Contains(r.UrlContains, StringComparison.OrdinalIgnoreCase))
                .OrderByDescending(r => r.UrlContains.Length)
                .FirstOrDefault();

            if (bestMatch != default)
            {
                return Task.FromResult(new HttpResponseMessage(bestMatch.Status)
                {
                    Content = new StringContent(bestMatch.Body, System.Text.Encoding.UTF8, "application/json"),
                });
            }

            return Task.FromResult(new HttpResponseMessage(HttpStatusCode.NotFound));
        }
    }
}
