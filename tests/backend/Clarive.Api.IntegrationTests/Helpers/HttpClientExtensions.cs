using System.Net.Http.Headers;
using System.Net.Http.Json;
using System.Text.Json;

namespace Clarive.Api.IntegrationTests.Helpers;

public static class HttpClientExtensions
{
    public static readonly JsonSerializerOptions JsonOptions = new()
    {
        PropertyNameCaseInsensitive = true,
    };

    /// <summary>Sets the Authorization: Bearer header and returns the same client for chaining.</summary>
    public static HttpClient WithBearerToken(this HttpClient client, string token)
    {
        client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", token);
        return client;
    }

    /// <summary>Sets the X-Api-Key header (and clears Bearer) and returns the same client for chaining.</summary>
    public static HttpClient WithApiKey(this HttpClient client, string apiKey)
    {
        client.DefaultRequestHeaders.Authorization = null;
        client.DefaultRequestHeaders.Remove("X-Api-Key");
        client.DefaultRequestHeaders.Add("X-Api-Key", apiKey);
        return client;
    }

    /// <summary>POST JSON and return deserialized response.</summary>
    public static async Task<(HttpResponseMessage Response, T? Body)> PostJsonAsync<T>(
        this HttpClient client,
        string url,
        object payload
    )
    {
        var response = await client.PostAsJsonAsync(url, payload);
        var body = response.IsSuccessStatusCode
            ? await response.Content.ReadFromJsonAsync<T>(JsonOptions)
            : default;
        return (response, body);
    }

    /// <summary>PATCH JSON and return deserialized response.</summary>
    public static async Task<(HttpResponseMessage Response, T? Body)> PatchJsonAsync<T>(
        this HttpClient client,
        string url,
        object payload
    )
    {
        var content = JsonContent.Create(payload);
        var response = await client.PatchAsync(url, content);
        var body = response.IsSuccessStatusCode
            ? await response.Content.ReadFromJsonAsync<T>(JsonOptions)
            : default;
        return (response, body);
    }

    /// <summary>Read response body as deserialized JSON.</summary>
    public static async Task<T?> ReadJsonAsync<T>(this HttpResponseMessage response)
    {
        return await response.Content.ReadFromJsonAsync<T>(JsonOptions);
    }

    /// <summary>Read response body as a JsonElement for dynamic access.</summary>
    public static async Task<JsonElement> ReadJsonAsync(this HttpResponseMessage response)
    {
        return await response.Content.ReadFromJsonAsync<JsonElement>(JsonOptions);
    }
}
