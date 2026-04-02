using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using Clarive.Api.IntegrationTests.Fixtures;
using Clarive.Api.IntegrationTests.Helpers;
using FluentAssertions;
using Xunit;

namespace Clarive.Api.IntegrationTests.Tests.Super;

[Collection("Integration")]
public class AiProviderTests : IntegrationTestBase
{
    private const string ProvidersUrl = "/api/super/ai-providers";

    public AiProviderTests(IntegrationTestFixture fixture)
        : base(fixture) { }

    // ── Helpers ──

    private async Task<string> CreateTestProvider()
    {
        var token = await AuthHelper.GetAdminTokenAsync(Client);
        Client.WithBearerToken(token);

        var response = await Client.PostAsJsonAsync(
            ProvidersUrl,
            new { name = $"test-provider-{Guid.NewGuid():N}", apiKey = "sk-test-key-placeholder" }
        );
        response.StatusCode.Should().Be(HttpStatusCode.Created);

        var json = await response.ReadJsonAsync();
        return json.GetProperty("id").GetString()!;
    }

    private async Task<(HttpStatusCode Status, JsonElement Json)> PostModel(
        string providerId,
        object payload
    )
    {
        var response = await Client.PostAsJsonAsync($"{ProvidersUrl}/{providerId}/models", payload);
        var json = await response.ReadJsonAsync();
        return (response.StatusCode, json);
    }

    private async Task<(HttpStatusCode Status, JsonElement Json)> PatchModel(
        string providerId,
        string modelId,
        object payload
    )
    {
        var content = JsonContent.Create(payload);
        var response = await Client.PatchAsync(
            $"{ProvidersUrl}/{providerId}/models/{modelId}",
            content
        );
        var json = await response.ReadJsonAsync();
        return (response.StatusCode, json);
    }

    // ── AddModel with default parameters ──

    [Fact]
    public async Task AddModel_WithDefaultParameters_ReturnsParametersInResponse()
    {
        var providerId = await CreateTestProvider();

        var (status, json) = await PostModel(
            providerId,
            new
            {
                modelId = "gpt-4o-test",
                defaultTemperature = 0.7f,
                defaultMaxTokens = 8192,
                defaultReasoningEffort = "high",
            }
        );

        status.Should().Be(HttpStatusCode.Created);
        json.GetProperty("defaultTemperature").GetSingle().Should().BeApproximately(0.7f, 0.01f);
        json.GetProperty("defaultMaxTokens").GetInt32().Should().Be(8192);
        json.GetProperty("defaultReasoningEffort").GetString().Should().Be("high");
    }

    [Fact]
    public async Task AddModel_WithoutDefaultParameters_ReturnsNulls()
    {
        var providerId = await CreateTestProvider();

        var (status, json) = await PostModel(providerId, new { modelId = "gpt-4o-mini-test" });

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
        var (addStatus, addJson) = await PostModel(
            providerId,
            new
            {
                modelId = "gpt-4o-update-test",
                defaultTemperature = 0.5f,
                defaultMaxTokens = 4096,
            }
        );
        addStatus.Should().Be(HttpStatusCode.Created);
        var modelId = addJson.GetProperty("id").GetString()!;

        // Update defaults
        var (updateStatus, updateJson) = await PatchModel(
            providerId,
            modelId,
            new
            {
                defaultTemperature = 1.2f,
                defaultMaxTokens = 16384,
                defaultReasoningEffort = "low",
            }
        );

        updateStatus.Should().Be(HttpStatusCode.OK);
        updateJson
            .GetProperty("defaultTemperature")
            .GetSingle()
            .Should()
            .BeApproximately(1.2f, 0.01f);
        updateJson.GetProperty("defaultMaxTokens").GetInt32().Should().Be(16384);
        updateJson.GetProperty("defaultReasoningEffort").GetString().Should().Be("low");
    }

    // ── GetAll returns models with defaults ──

    [Fact]
    public async Task GetAll_ReturnsModelsWithDefaultParameters()
    {
        var providerId = await CreateTestProvider();

        await PostModel(
            providerId,
            new
            {
                modelId = "gpt-4o-getall-test",
                defaultTemperature = 0.3f,
                defaultMaxTokens = 2048,
                defaultReasoningEffort = "medium",
            }
        );

        var response = await Client.GetAsync(ProvidersUrl);
        response.StatusCode.Should().Be(HttpStatusCode.OK);

        var providers = await response.ReadJsonAsync();
        var testProvider = providers
            .EnumerateArray()
            .First(p => p.GetProperty("id").GetString() == providerId);
        var model = testProvider
            .GetProperty("models")
            .EnumerateArray()
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

        var (status, _) = await PostModel(
            providerId,
            new { modelId = "gpt-4o-invalid-effort", defaultReasoningEffort = "invalid-value" }
        );

        status.Should().Be(HttpStatusCode.UnprocessableEntity);
    }

    [Fact]
    public async Task UpdateModel_InvalidReasoningEffort_Returns422()
    {
        var providerId = await CreateTestProvider();

        var (addStatus, addJson) = await PostModel(
            providerId,
            new { modelId = "gpt-4o-effort-update", defaultReasoningEffort = "low" }
        );
        addStatus.Should().Be(HttpStatusCode.Created);
        var modelId = addJson.GetProperty("id").GetString()!;

        var (updateStatus, _) = await PatchModel(
            providerId,
            modelId,
            new { defaultReasoningEffort = "ultra-extreme" }
        );

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

        var (status, json) = await PostModel(
            providerId,
            new { modelId = $"gpt-4o-valid-{effort}", defaultReasoningEffort = effort }
        );

        status.Should().Be(HttpStatusCode.Created);
        json.GetProperty("defaultReasoningEffort").GetString().Should().Be(effort);
    }

    // ── PATCH null-skip behavior: omitting a field preserves existing value ──

    [Fact]
    public async Task UpdateModel_OmitDefaultTemperature_PreservesExistingValue()
    {
        var providerId = await CreateTestProvider();

        // Add model with temperature set
        var (addStatus, addJson) = await PostModel(
            providerId,
            new
            {
                modelId = "gpt-4o-preserve-test",
                defaultTemperature = 0.7f,
                defaultMaxTokens = 8192,
            }
        );
        addStatus.Should().Be(HttpStatusCode.Created);
        var modelId = addJson.GetProperty("id").GetString()!;

        // PATCH only displayName — temperature and maxTokens should be preserved
        var (updateStatus, updateJson) = await PatchModel(
            providerId,
            modelId,
            new { displayName = "Patched Name" }
        );

        updateStatus.Should().Be(HttpStatusCode.OK);
        updateJson.GetProperty("displayName").GetString().Should().Be("Patched Name");
        updateJson
            .GetProperty("defaultTemperature")
            .GetSingle()
            .Should()
            .BeApproximately(0.7f, 0.01f);
        updateJson.GetProperty("defaultMaxTokens").GetInt32().Should().Be(8192);
    }

    // ── isTemperatureConfigurable removed from response ──

    [Fact]
    public async Task AddModel_ResponseDoesNotContainIsTemperatureConfigurable()
    {
        var providerId = await CreateTestProvider();

        var (status, json) = await PostModel(providerId, new { modelId = "gpt-4o-no-temp-config" });

        status.Should().Be(HttpStatusCode.Created);
        json.TryGetProperty("isTemperatureConfigurable", out _)
            .Should()
            .BeFalse(
                "isTemperatureConfigurable was removed — temperature configurability is derived from !isReasoning"
            );
    }

    // ── AddModel with isReasoning pre-fill ──

    [Fact]
    public async Task AddModel_WithIsReasoningTrue_PreFillsReasoningDefaults()
    {
        var providerId = await CreateTestProvider();

        var (status, json) = await PostModel(
            providerId,
            new
            {
                modelId = "o3-reasoning-test",
                isReasoning = true,
                defaultReasoningEffort = "medium",
            }
        );

        status.Should().Be(HttpStatusCode.Created);
        json.GetProperty("isReasoning").GetBoolean().Should().BeTrue();
        json.GetProperty("defaultReasoningEffort").GetString().Should().Be("medium");
    }

    [Fact]
    public async Task AddModel_WithIsReasoningFalse_StandardDefaults()
    {
        var providerId = await CreateTestProvider();

        var (status, json) = await PostModel(
            providerId,
            new { modelId = "gpt-4o-standard-test", isReasoning = false }
        );

        status.Should().Be(HttpStatusCode.Created);
        json.GetProperty("isReasoning").GetBoolean().Should().BeFalse();
    }

    // ── LiteLLM cost fields and override tests ──

    [Fact]
    public async Task AddModel_WithExplicitCosts_PreservesCosts()
    {
        var providerId = await CreateTestProvider();

        var (status, json) = await PostModel(
            providerId,
            new
            {
                modelId = "cost-preserve-test",
                inputCostPerMillion = 99.99m,
                outputCostPerMillion = 199.99m,
                maxInputTokens = 50000L,
            }
        );

        status.Should().Be(HttpStatusCode.Created);
        json.GetProperty("inputCostPerMillion").GetDecimal().Should().Be(99.99m);
        json.GetProperty("outputCostPerMillion").GetDecimal().Should().Be(199.99m);
        json.GetProperty("maxInputTokens").GetInt64().Should().Be(50000);
    }

    [Fact]
    public async Task AddModel_ResponseIncludesSplitContextFields()
    {
        var providerId = await CreateTestProvider();

        var (status, json) = await PostModel(
            providerId,
            new
            {
                modelId = "context-split-test",
                maxInputTokens = 200000,
                maxOutputTokens = 8192,
            }
        );

        status.Should().Be(HttpStatusCode.Created);
        json.GetProperty("maxInputTokens").GetInt32().Should().Be(200000);
        json.GetProperty("maxOutputTokens").GetInt32().Should().Be(8192);
        json.TryGetProperty("maxContextSize", out _)
            .Should()
            .BeFalse("maxContextSize was replaced by maxInputTokens + maxOutputTokens");
    }

    // ── HasManualCostOverride tests ──

    [Fact]
    public async Task AddModel_DefaultsToNoManualOverride()
    {
        var providerId = await CreateTestProvider();

        var (status, json) = await PostModel(providerId, new { modelId = "override-default-test" });

        status.Should().Be(HttpStatusCode.Created);
        json.GetProperty("hasManualCostOverride").GetBoolean().Should().BeFalse();
    }

    [Fact]
    public async Task PatchModel_CostField_AutoEnablesOverride()
    {
        var providerId = await CreateTestProvider();

        var (addStatus, addJson) = await PostModel(
            providerId,
            new { modelId = "override-auto-test" }
        );
        addStatus.Should().Be(HttpStatusCode.Created);
        addJson.GetProperty("hasManualCostOverride").GetBoolean().Should().BeFalse();
        var modelId = addJson.GetProperty("id").GetString()!;

        // PATCH with a cost field should auto-enable override
        var (patchStatus, patchJson) = await PatchModel(
            providerId,
            modelId,
            new { inputCostPerMillion = 5.0m }
        );

        patchStatus.Should().Be(HttpStatusCode.OK);
        patchJson.GetProperty("hasManualCostOverride").GetBoolean().Should().BeTrue();
    }

    [Fact]
    public async Task PatchModel_ExplicitlyDisableOverride()
    {
        var providerId = await CreateTestProvider();

        var (addStatus, addJson) = await PostModel(
            providerId,
            new { modelId = "override-disable-test" }
        );
        var modelId = addJson.GetProperty("id").GetString()!;

        // Enable override by setting a cost
        await PatchModel(providerId, modelId, new { inputCostPerMillion = 5.0m });

        // Explicitly disable override
        var (status, json) = await PatchModel(
            providerId,
            modelId,
            new { hasManualCostOverride = false }
        );

        status.Should().Be(HttpStatusCode.OK);
        json.GetProperty("hasManualCostOverride").GetBoolean().Should().BeFalse();
    }

    // ── Custom Headers ──

    [Fact]
    public async Task CreateProvider_WithCustomHeaders_ReturnsHeadersInResponse()
    {
        var token = await AuthHelper.GetAdminTokenAsync(Client);
        Client.WithBearerToken(token);

        var response = await Client.PostAsJsonAsync(
            ProvidersUrl,
            new
            {
                name = $"headers-test-{Guid.NewGuid():N}",
                apiKey = "sk-test-key",
                customHeaders = new Dictionary<string, string>
                {
                    ["HTTP-Referer"] = "https://app.clarive.dev",
                    ["X-OpenRouter-Title"] = "Clarive",
                },
            }
        );

        response.StatusCode.Should().Be(HttpStatusCode.Created);
        var json = await response.ReadJsonAsync();

        json.GetProperty("customHeaders").GetProperty("HTTP-Referer").GetString().Should().Be("https://app.clarive.dev");
        json.GetProperty("customHeaders").GetProperty("X-OpenRouter-Title").GetString().Should().Be("Clarive");
    }

    [Fact]
    public async Task CreateProvider_WithoutCustomHeaders_ReturnsNullOrMissingHeaders()
    {
        var token = await AuthHelper.GetAdminTokenAsync(Client);
        Client.WithBearerToken(token);

        var response = await Client.PostAsJsonAsync(
            ProvidersUrl,
            new { name = $"no-headers-test-{Guid.NewGuid():N}", apiKey = "sk-test-key" }
        );

        response.StatusCode.Should().Be(HttpStatusCode.Created);
        var json = await response.ReadJsonAsync();

        // customHeaders may be null or omitted depending on serializer settings
        if (json.TryGetProperty("customHeaders", out var headers))
            headers.ValueKind.Should().Be(JsonValueKind.Null);
    }

    [Fact]
    public async Task PatchProvider_UpdateCustomHeaders_ReflectsChanges()
    {
        var token = await AuthHelper.GetAdminTokenAsync(Client);
        Client.WithBearerToken(token);

        // Create provider without headers
        var createResponse = await Client.PostAsJsonAsync(
            ProvidersUrl,
            new { name = $"update-headers-test-{Guid.NewGuid():N}", apiKey = "sk-test-key" }
        );
        var createJson = await createResponse.ReadJsonAsync();
        var providerId = createJson.GetProperty("id").GetString()!;

        // Update with headers
        var patchContent = JsonContent.Create(new
        {
            customHeaders = new Dictionary<string, string> { ["X-Custom"] = "value1" },
        });
        var patchResponse = await Client.PatchAsync($"{ProvidersUrl}/{providerId}", patchContent);

        patchResponse.StatusCode.Should().Be(HttpStatusCode.OK);
        var patchJson = await patchResponse.ReadJsonAsync();
        patchJson.GetProperty("customHeaders").GetProperty("X-Custom").GetString().Should().Be("value1");
    }

    // ── UseProviderPricing ──

    [Fact]
    public async Task CreateProvider_DefaultsUseProviderPricingToFalse()
    {
        var token = await AuthHelper.GetAdminTokenAsync(Client);
        Client.WithBearerToken(token);

        var response = await Client.PostAsJsonAsync(
            ProvidersUrl,
            new { name = $"pricing-default-{Guid.NewGuid():N}", apiKey = "sk-test-key" }
        );

        response.StatusCode.Should().Be(HttpStatusCode.Created);
        var json = await response.ReadJsonAsync();
        json.GetProperty("useProviderPricing").GetBoolean().Should().BeFalse();
    }

    [Fact]
    public async Task PatchProvider_EnableUseProviderPricing_Persists()
    {
        var token = await AuthHelper.GetAdminTokenAsync(Client);
        Client.WithBearerToken(token);

        var createResponse = await Client.PostAsJsonAsync(
            ProvidersUrl,
            new { name = $"pricing-toggle-{Guid.NewGuid():N}", apiKey = "sk-test-key" }
        );
        var createJson = await createResponse.ReadJsonAsync();
        var providerId = createJson.GetProperty("id").GetString()!;

        // Enable provider pricing
        var patchContent = JsonContent.Create(new { useProviderPricing = true });
        var patchResponse = await Client.PatchAsync($"{ProvidersUrl}/{providerId}", patchContent);

        patchResponse.StatusCode.Should().Be(HttpStatusCode.OK);
        var patchJson = await patchResponse.ReadJsonAsync();
        patchJson.GetProperty("useProviderPricing").GetBoolean().Should().BeTrue();

        // Verify via GET
        var getResponse = await Client.GetAsync(ProvidersUrl);
        var providers = await getResponse.ReadJsonAsync();
        var provider = providers
            .EnumerateArray()
            .First(p => p.GetProperty("id").GetString() == providerId);
        provider.GetProperty("useProviderPricing").GetBoolean().Should().BeTrue();
    }

    [Fact]
    public async Task GetAll_ReturnsCustomHeadersAndUseProviderPricing()
    {
        var token = await AuthHelper.GetAdminTokenAsync(Client);
        Client.WithBearerToken(token);

        var response = await Client.PostAsJsonAsync(
            ProvidersUrl,
            new
            {
                name = $"getall-headers-{Guid.NewGuid():N}",
                apiKey = "sk-test-key",
                customHeaders = new Dictionary<string, string> { ["X-Test"] = "hello" },
            }
        );
        var createJson = await response.ReadJsonAsync();
        var providerId = createJson.GetProperty("id").GetString()!;

        var getResponse = await Client.GetAsync(ProvidersUrl);
        getResponse.StatusCode.Should().Be(HttpStatusCode.OK);

        var providers = await getResponse.ReadJsonAsync();
        var provider = providers
            .EnumerateArray()
            .First(p => p.GetProperty("id").GetString() == providerId);

        provider.GetProperty("customHeaders").GetProperty("X-Test").GetString().Should().Be("hello");
        provider.GetProperty("useProviderPricing").GetBoolean().Should().BeFalse();
    }
}
