using System.Net.Http.Headers;
using System.Net.Http.Json;
using System.Text.Json.Serialization;
using Clarive.Domain.Interfaces.Services;
using Microsoft.Extensions.Options;

namespace Clarive.Auth.GitHub;

public class GitHubAuthService : IGitHubAuthService
{
    private readonly IOptionsMonitor<GitHubAuthSettings> _optionsMonitor;
    private readonly IHttpClientFactory _httpClientFactory;

    public GitHubAuthService(
        IOptionsMonitor<GitHubAuthSettings> optionsMonitor,
        IHttpClientFactory httpClientFactory
    )
    {
        _optionsMonitor = optionsMonitor;
        _httpClientFactory = httpClientFactory;
    }

    public bool IsConfigured =>
        !string.IsNullOrWhiteSpace(_optionsMonitor.CurrentValue.ClientId);

    public string GetAuthorizationUrl(string redirectUri, string state)
    {
        var settings = _optionsMonitor.CurrentValue;
        var query = string.Join(
            "&",
            $"client_id={Uri.EscapeDataString(settings.ClientId)}",
            $"redirect_uri={Uri.EscapeDataString(redirectUri)}",
            $"scope={Uri.EscapeDataString("read:user user:email")}",
            $"state={Uri.EscapeDataString(state)}"
        );
        return $"https://github.com/login/oauth/authorize?{query}";
    }

    public async Task<GitHubUserInfo> ExchangeCodeForUserAsync(
        string code,
        string redirectUri,
        CancellationToken ct = default
    )
    {
        var settings = _optionsMonitor.CurrentValue;
        var client = _httpClientFactory.CreateClient("GitHub");

        // Step 1: Exchange authorization code for access token
        var tokenRequest = new Dictionary<string, string>
        {
            ["client_id"] = settings.ClientId,
            ["client_secret"] = settings.ClientSecret,
            ["code"] = code,
            ["redirect_uri"] = redirectUri,
        };

        var tokenResponse = await client.PostAsync(
            "https://github.com/login/oauth/access_token",
            new FormUrlEncodedContent(tokenRequest),
            ct
        );
        tokenResponse.EnsureSuccessStatusCode();

        var tokenResult = await tokenResponse.Content.ReadFromJsonAsync<GitHubTokenResponse>(ct)
            ?? throw new InvalidOperationException("Failed to parse GitHub token response.");

        if (!string.IsNullOrEmpty(tokenResult.Error))
            throw new InvalidOperationException(
                $"GitHub OAuth error: {tokenResult.Error} — {tokenResult.ErrorDescription}"
            );

        // Step 2: Fetch user profile
        using var userRequest = new HttpRequestMessage(
            HttpMethod.Get,
            "https://api.github.com/user"
        );
        userRequest.Headers.Authorization = new AuthenticationHeaderValue(
            "Bearer",
            tokenResult.AccessToken
        );

        var userResponse = await client.SendAsync(userRequest, ct);
        userResponse.EnsureSuccessStatusCode();

        var user = await userResponse.Content.ReadFromJsonAsync<GitHubUserResponse>(ct)
            ?? throw new InvalidOperationException("Failed to parse GitHub user response.");

        // Step 3: If email is null (private), fetch from /user/emails
        var email = user.Email;
        if (string.IsNullOrEmpty(email))
        {
            email = await FetchPrimaryVerifiedEmailAsync(client, tokenResult.AccessToken, ct);
        }

        if (string.IsNullOrEmpty(email))
            throw new InvalidOperationException(
                "Could not retrieve a verified email from GitHub."
            );

        var name = !string.IsNullOrWhiteSpace(user.Name) ? user.Name : user.Login;

        return new GitHubUserInfo(
            GitHubId: user.Id.ToString(),
            Email: email,
            Name: name,
            AvatarUrl: user.AvatarUrl
        );
    }

    private static async Task<string?> FetchPrimaryVerifiedEmailAsync(
        HttpClient client,
        string accessToken,
        CancellationToken ct
    )
    {
        using var request = new HttpRequestMessage(
            HttpMethod.Get,
            "https://api.github.com/user/emails"
        );
        request.Headers.Authorization = new AuthenticationHeaderValue("Bearer", accessToken);

        var response = await client.SendAsync(request, ct);
        response.EnsureSuccessStatusCode();

        var emails =
            await response.Content.ReadFromJsonAsync<List<GitHubEmailResponse>>(ct) ?? [];

        // Prefer primary + verified; fall back to any verified email
        var primary = emails.FirstOrDefault(e => e.Primary && e.Verified);
        return primary?.Email ?? emails.FirstOrDefault(e => e.Verified)?.Email;
    }

    // ── GitHub API response models ──

    private sealed record GitHubTokenResponse
    {
        [JsonPropertyName("access_token")]
        public string AccessToken { get; init; } = "";

        [JsonPropertyName("token_type")]
        public string TokenType { get; init; } = "";

        [JsonPropertyName("scope")]
        public string Scope { get; init; } = "";

        [JsonPropertyName("error")]
        public string? Error { get; init; }

        [JsonPropertyName("error_description")]
        public string? ErrorDescription { get; init; }
    }

    private sealed record GitHubUserResponse
    {
        [JsonPropertyName("id")]
        public long Id { get; init; }

        [JsonPropertyName("login")]
        public string Login { get; init; } = "";

        [JsonPropertyName("name")]
        public string? Name { get; init; }

        [JsonPropertyName("email")]
        public string? Email { get; init; }

        [JsonPropertyName("avatar_url")]
        public string? AvatarUrl { get; init; }
    }

    private sealed record GitHubEmailResponse
    {
        [JsonPropertyName("email")]
        public string Email { get; init; } = "";

        [JsonPropertyName("primary")]
        public bool Primary { get; init; }

        [JsonPropertyName("verified")]
        public bool Verified { get; init; }
    }
}
