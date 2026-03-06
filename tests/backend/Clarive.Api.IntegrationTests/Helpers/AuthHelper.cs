using System.Collections.Concurrent;
using System.Net.Http.Json;
using System.Text.Json;

namespace Clarive.Api.IntegrationTests.Helpers;

/// <summary>
/// Caches JWT tokens per role so login is only called once per test run.
/// Uses ConcurrentDictionary for thread safety and a TTL to avoid stale tokens.
/// </summary>
public static class AuthHelper
{
    private static readonly ConcurrentDictionary<string, (string Token, DateTime CachedAt)> TokenCache = new();
    private static readonly TimeSpan TokenTtl = TimeSpan.FromMinutes(10);
    private static readonly JsonSerializerOptions JsonOptions = new()
    {
        PropertyNameCaseInsensitive = true
    };

    public static async Task<string> GetAdminTokenAsync(HttpClient client)
        => await GetTokenAsync(client, "admin@clarive.dev", "password");

    public static async Task<string> GetEditorTokenAsync(HttpClient client)
        => await GetTokenAsync(client, "jane@clarive.dev", "password");

    public static async Task<string> GetViewerTokenAsync(HttpClient client)
        => await GetTokenAsync(client, "sam@clarive.dev", "password");

    public static async Task<string> GetTokenAsync(HttpClient client, string email, string password)
    {
        if (TokenCache.TryGetValue(email, out var cached) && DateTime.UtcNow - cached.CachedAt < TokenTtl)
            return cached.Token;

        var response = await client.PostAsJsonAsync("/api/auth/login", new { email, password });
        response.EnsureSuccessStatusCode();

        var json = await response.Content.ReadFromJsonAsync<JsonElement>(JsonOptions);
        var token = json.GetProperty("token").GetString()!;

        TokenCache[email] = (token, DateTime.UtcNow);
        return token;
    }
}
