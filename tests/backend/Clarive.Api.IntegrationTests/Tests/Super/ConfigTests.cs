using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using Clarive.Api.IntegrationTests.Fixtures;
using Clarive.Api.IntegrationTests.Helpers;
using FluentAssertions;
using Xunit;

namespace Clarive.Api.IntegrationTests.Tests.Super;

[Collection("Integration")]
public class ConfigTests : IntegrationTestBase
{
    public ConfigTests(IntegrationTestFixture fixture)
        : base(fixture) { }

    [Fact]
    public async Task GetAll_AsSuperUser_ReturnsConfigList()
    {
        var token = await AuthHelper.GetAdminTokenAsync(Client);
        Client.WithBearerToken(token);

        var response = await Client.GetAsync("/api/super/config");

        response.StatusCode.Should().Be(HttpStatusCode.OK);
        var body = await response.ReadJsonAsync();

        body.GetProperty("serverStartedAtUtc").GetString().Should().NotBeNullOrEmpty();

        var configs = body.GetProperty("settings");
        configs.GetArrayLength().Should().BeGreaterOrEqualTo(1);

        var first = configs[0];
        first.GetProperty("key").GetString().Should().NotBeNullOrEmpty();
        first.GetProperty("label").GetString().Should().NotBeNullOrEmpty();
        first.GetProperty("section").GetString().Should().NotBeNullOrEmpty();
    }

    [Fact]
    public async Task GetAll_AsNonSuperUser_Returns403()
    {
        var token = await AuthHelper.GetEditorTokenAsync(Client);
        Client.WithBearerToken(token);

        var response = await Client.GetAsync("/api/super/config");
        response.StatusCode.Should().Be(HttpStatusCode.Forbidden);
    }

    [Fact]
    public async Task SetAndDeleteValue_NonSecretKey_RoundTrips()
    {
        var token = await AuthHelper.GetAdminTokenAsync(Client);
        Client.WithBearerToken(token);

        // Find a non-secret key from the config list
        var listResponse = await Client.GetAsync("/api/super/config");
        var listBody = await listResponse.ReadJsonAsync();
        var configs = listBody.GetProperty("settings");
        string? testKey = null;
        foreach (var c in configs.EnumerateArray())
        {
            if (!c.GetProperty("isSecret").GetBoolean())
            {
                testKey = c.GetProperty("key").GetString();
                break;
            }
        }

        if (testKey is null)
            return; // Skip if no non-secret keys

        // Set value
        var content = JsonContent.Create(new { value = "test-value-123" });
        var setResponse = await Client.PutAsync(
            $"/api/super/config/{Uri.EscapeDataString(testKey)}",
            content
        );
        setResponse.StatusCode.Should().Be(HttpStatusCode.OK);
        var setJson = await setResponse.ReadJsonAsync();
        setJson.GetProperty("updated").GetBoolean().Should().BeTrue();

        // Delete (reset)
        var deleteResponse = await Client.DeleteAsync(
            $"/api/super/config/{Uri.EscapeDataString(testKey)}"
        );
        deleteResponse.StatusCode.Should().Be(HttpStatusCode.OK);
        var deleteJson = await deleteResponse.ReadJsonAsync();
        deleteJson.GetProperty("reset").GetBoolean().Should().BeTrue();
    }

    [Fact]
    public async Task SetValue_UnknownKey_Returns404()
    {
        var token = await AuthHelper.GetAdminTokenAsync(Client);
        Client.WithBearerToken(token);

        var content = JsonContent.Create(new { value = "anything" });
        var response = await Client.PutAsync("/api/super/config/NonExistentKey", content);

        response.StatusCode.Should().Be(HttpStatusCode.NotFound);
    }

    [Fact]
    public async Task SetValue_EmptyValue_Returns400()
    {
        var token = await AuthHelper.GetAdminTokenAsync(Client);
        Client.WithBearerToken(token);

        // Get a valid key
        var listResponse = await Client.GetAsync("/api/super/config");
        var listBody = await listResponse.ReadJsonAsync();
        var firstKey = listBody.GetProperty("settings")[0].GetProperty("key").GetString()!;

        var content = JsonContent.Create(new { value = "" });
        var response = await Client.PutAsync(
            $"/api/super/config/{Uri.EscapeDataString(firstKey)}",
            content
        );

        response.StatusCode.Should().Be(HttpStatusCode.BadRequest);
    }

    [Fact]
    public async Task DeleteValue_UnknownKey_Returns404()
    {
        var token = await AuthHelper.GetAdminTokenAsync(Client);
        Client.WithBearerToken(token);

        var response = await Client.DeleteAsync("/api/super/config/NonExistentKey");
        response.StatusCode.Should().Be(HttpStatusCode.NotFound);
    }
}
