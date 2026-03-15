using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using FluentAssertions;
using Clarive.Api.IntegrationTests.Fixtures;
using Clarive.Api.IntegrationTests.Helpers;
using Xunit;

namespace Clarive.Api.IntegrationTests.Tests.Super;

[Collection("Integration")]
public class AiProviderTests : IntegrationTestBase
{
    private const string ProvidersUrl = "/api/super/ai-providers";

    public AiProviderTests(IntegrationTestFixture fixture) : base(fixture) { }

    // ── Helpers ──

    private async Task<string> CreateTestProvider()
    {
        var token = await AuthHelper.GetAdminTokenAsync(Client);
        Client.WithBearerToken(token);

        var response = await Client.PostAsJsonAsync(ProvidersUrl, new
        {
            name = $"test-provider-{Guid.NewGuid():N}",
            apiKey = "sk-test-key-placeholder"
        });
        response.StatusCode.Should().Be(HttpStatusCode.Created);

        var json = await response.ReadJsonAsync();
        return json.GetProperty("id").GetString()!;
    }

    private async Task<(HttpStatusCode Status, JsonElement Json)> PostModel(
        string providerId, object payload)
    {
        var response = await Client.PostAsJsonAsync($"{ProvidersUrl}/{providerId}/models", payload);
        var json = await response.ReadJsonAsync();
        return (response.StatusCode, json);
    }

    private async Task<(HttpStatusCode Status, JsonElement Json)> PatchModel(
        string providerId, string modelId, object payload)
    {
        var content = JsonContent.Create(payload);
        var response = await Client.PatchAsync($"{ProvidersUrl}/{providerId}/models/{modelId}", content);
        var json = await response.ReadJsonAsync();
        return (response.StatusCode, json);
    }

    // ── AddModel with default parameters ──

    [Fact]
    public async Task AddModel_WithDefaultParameters_ReturnsParametersInResponse()
    {
        var providerId = await CreateTestProvider();

        var (status, json) = await PostModel(providerId, new
        {
            modelId = "gpt-4o-test",
            defaultTemperature = 0.7f,
            defaultMaxTokens = 8192,
            defaultReasoningEffort = "high"
        });

        status.Should().Be(HttpStatusCode.Created);
        json.GetProperty("defaultTemperature").GetSingle().Should().BeApproximately(0.7f, 0.01f);
        json.GetProperty("defaultMaxTokens").GetInt32().Should().Be(8192);
        json.GetProperty("defaultReasoningEffort").GetString().Should().Be("high");
    }

    [Fact]
    public async Task AddModel_WithoutDefaultParameters_ReturnsNulls()
    {
        var providerId = await CreateTestProvider();

        var (status, json) = await PostModel(providerId, new
        {
            modelId = "gpt-4o-mini-test"
        });

        status.Should().Be(HttpStatusCode.Created);
        // Null values may be omitted or serialized as null
        if (json.TryGetProperty("defaultTemperature", out var temp))
            temp.ValueKind.Should().Be(JsonValueKind.Null);
        if (json.TryGetProperty("defaultMaxTokens", out var tokens))
            tokens.ValueKind.Should().Be(JsonValueKind.Null);
        if (json.TryGetProperty("defaultReasoningEffort", out var effort))
            effort.ValueKind.Should().Be(JsonValueKind.Null);
    }

    // ── UpdateModel with default parameters ──

    [Fact]
    public async Task UpdateModel_ChangeDefaultParameters_ReturnsUpdatedValues()
    {
        var providerId = await CreateTestProvider();

        // Add model with initial defaults
        var (addStatus, addJson) = await PostModel(providerId, new
        {
            modelId = "gpt-4o-update-test",
            defaultTemperature = 0.5f,
            defaultMaxTokens = 4096
        });
        addStatus.Should().Be(HttpStatusCode.Created);
        var modelId = addJson.GetProperty("id").GetString()!;

        // Update defaults
        var (updateStatus, updateJson) = await PatchModel(providerId, modelId, new
        {
            defaultTemperature = 1.2f,
            defaultMaxTokens = 16384,
            defaultReasoningEffort = "low"
        });

        updateStatus.Should().Be(HttpStatusCode.OK);
        updateJson.GetProperty("defaultTemperature").GetSingle().Should().BeApproximately(1.2f, 0.01f);
        updateJson.GetProperty("defaultMaxTokens").GetInt32().Should().Be(16384);
        updateJson.GetProperty("defaultReasoningEffort").GetString().Should().Be("low");
    }

    // ── GetAll returns models with defaults ──

    [Fact]
    public async Task GetAll_ReturnsModelsWithDefaultParameters()
    {
        var providerId = await CreateTestProvider();

        await PostModel(providerId, new
        {
            modelId = "gpt-4o-getall-test",
            defaultTemperature = 0.3f,
            defaultMaxTokens = 2048,
            defaultReasoningEffort = "medium"
        });

        var response = await Client.GetAsync(ProvidersUrl);
        response.StatusCode.Should().Be(HttpStatusCode.OK);

        var providers = await response.ReadJsonAsync();
        var testProvider = providers.EnumerateArray()
            .First(p => p.GetProperty("id").GetString() == providerId);
        var model = testProvider.GetProperty("models").EnumerateArray()
            .First(m => m.GetProperty("modelId").GetString() == "gpt-4o-getall-test");

        model.GetProperty("defaultTemperature").GetSingle().Should().BeApproximately(0.3f, 0.01f);
        model.GetProperty("defaultMaxTokens").GetInt32().Should().Be(2048);
        model.GetProperty("defaultReasoningEffort").GetString().Should().Be("medium");
    }

    // ── Validation: invalid reasoning effort rejected ──

    [Fact]
    public async Task AddModel_InvalidReasoningEffort_Returns422()
    {
        var providerId = await CreateTestProvider();

        var (status, _) = await PostModel(providerId, new
        {
            modelId = "gpt-4o-invalid-effort",
            defaultReasoningEffort = "invalid-value"
        });

        status.Should().Be(HttpStatusCode.UnprocessableEntity);
    }

    [Fact]
    public async Task UpdateModel_InvalidReasoningEffort_Returns422()
    {
        var providerId = await CreateTestProvider();

        var (addStatus, addJson) = await PostModel(providerId, new
        {
            modelId = "gpt-4o-effort-update",
            defaultReasoningEffort = "low"
        });
        addStatus.Should().Be(HttpStatusCode.Created);
        var modelId = addJson.GetProperty("id").GetString()!;

        var (updateStatus, _) = await PatchModel(providerId, modelId, new
        {
            defaultReasoningEffort = "ultra-extreme"
        });

        updateStatus.Should().Be(HttpStatusCode.UnprocessableEntity);
    }

    [Theory]
    [InlineData("low")]
    [InlineData("medium")]
    [InlineData("high")]
    [InlineData("extra-high")]
    public async Task AddModel_ValidReasoningEffort_Accepted(string effort)
    {
        var providerId = await CreateTestProvider();

        var (status, json) = await PostModel(providerId, new
        {
            modelId = $"gpt-4o-valid-{effort}",
            defaultReasoningEffort = effort
        });

        status.Should().Be(HttpStatusCode.Created);
        json.GetProperty("defaultReasoningEffort").GetString().Should().Be(effort);
    }

    // ── PATCH null-skip behavior: omitting a field preserves existing value ──

    [Fact]
    public async Task UpdateModel_OmitDefaultTemperature_PreservesExistingValue()
    {
        var providerId = await CreateTestProvider();

        // Add model with temperature set
        var (addStatus, addJson) = await PostModel(providerId, new
        {
            modelId = "gpt-4o-preserve-test",
            defaultTemperature = 0.7f,
            defaultMaxTokens = 8192
        });
        addStatus.Should().Be(HttpStatusCode.Created);
        var modelId = addJson.GetProperty("id").GetString()!;

        // PATCH only displayName — temperature and maxTokens should be preserved
        var (updateStatus, updateJson) = await PatchModel(providerId, modelId, new
        {
            displayName = "Patched Name"
        });

        updateStatus.Should().Be(HttpStatusCode.OK);
        updateJson.GetProperty("displayName").GetString().Should().Be("Patched Name");
        updateJson.GetProperty("defaultTemperature").GetSingle().Should().BeApproximately(0.7f, 0.01f);
        updateJson.GetProperty("defaultMaxTokens").GetInt32().Should().Be(8192);
    }
}
