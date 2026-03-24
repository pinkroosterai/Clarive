using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using Clarive.Api.IntegrationTests.Fixtures;
using Clarive.Api.IntegrationTests.Helpers;
using FluentAssertions;
using Xunit;

namespace Clarive.Api.IntegrationTests.Tests.AbTests;

[Collection("Integration")]
public class AbTestTests : IntegrationTestBase
{
    public AbTestTests(IntegrationTestFixture fixture)
        : base(fixture) { }

    private async Task<(string EntryId, string DatasetId)> CreateEntryWithDatasetAsync()
    {
        var token = await AuthHelper.GetEditorTokenAsync(Client);
        Client.WithBearerToken(token);

        // Create entry with template fields
        var (entryResponse, entryBody) = await Client.PostJsonAsync<JsonElement>(
            "/api/entries",
            new
            {
                title = TestData.UniqueEntryTitle(),
                systemMessage = "You are a helpful assistant.",
                prompts = new[] { new { content = "Write about {{topic}} for {{audience}}" } },
            }
        );
        entryResponse.StatusCode.Should().Be(HttpStatusCode.Created);
        var entryId = entryBody.GetProperty("id").GetString()!;

        // Create dataset
        var (datasetResponse, datasetBody) = await Client.PostJsonAsync<JsonElement>(
            $"/api/entries/{entryId}/datasets",
            new { name = "AB Test Dataset" }
        );
        datasetResponse.StatusCode.Should().Be(HttpStatusCode.Created);
        var datasetId = datasetBody.GetProperty("id").GetString()!;

        // Add rows
        await Client.PostAsJsonAsync(
            $"/api/entries/{entryId}/datasets/{datasetId}/rows",
            new { values = new { topic = "AI", audience = "developers" } }
        );
        await Client.PostAsJsonAsync(
            $"/api/entries/{entryId}/datasets/{datasetId}/rows",
            new { values = new { topic = "ML", audience = "students" } }
        );

        return (entryId, datasetId);
    }

    [Fact]
    public async Task ListAbTests_Empty_ReturnsEmptyArray()
    {
        var (entryId, _) = await CreateEntryWithDatasetAsync();

        var response = await Client.GetAsync($"/api/entries/{entryId}/abtests");
        response.StatusCode.Should().Be(HttpStatusCode.OK);

        var body = await response.ReadJsonAsync();
        body.GetArrayLength().Should().Be(0);
    }

    [Fact]
    public async Task StartAbTest_AsViewer_Returns403()
    {
        var (entryId, datasetId) = await CreateEntryWithDatasetAsync();

        var viewerToken = await AuthHelper.GetViewerTokenAsync(Client);
        Client.WithBearerToken(viewerToken);

        var response = await Client.PostAsJsonAsync(
            $"/api/entries/{entryId}/abtests",
            new
            {
                versionANumber = 1,
                versionBNumber = 1,
                datasetId,
                model = "test-model",
                temperature = 1.0,
                maxTokens = 4096,
            }
        );

        response.StatusCode.Should().Be(HttpStatusCode.Forbidden);
    }

    [Fact]
    public async Task GetAbTest_NotFound_Returns404()
    {
        var (entryId, _) = await CreateEntryWithDatasetAsync();

        var nonExistentId = Guid.NewGuid();
        var response = await Client.GetAsync($"/api/entries/{entryId}/abtests/{nonExistentId}");
        response.StatusCode.Should().Be(HttpStatusCode.NotFound);
    }

    [Fact]
    public async Task DeleteAbTest_NotFound_Returns404()
    {
        var (entryId, _) = await CreateEntryWithDatasetAsync();

        var nonExistentId = Guid.NewGuid();
        var response = await Client.DeleteAsync($"/api/entries/{entryId}/abtests/{nonExistentId}");
        response.StatusCode.Should().Be(HttpStatusCode.NotFound);
    }

    [Fact]
    public async Task StartAbTest_EmptyDataset_Returns422()
    {
        var token = await AuthHelper.GetEditorTokenAsync(Client);
        Client.WithBearerToken(token);

        // Create entry
        var (entryResponse, entryBody) = await Client.PostJsonAsync<JsonElement>(
            "/api/entries",
            new
            {
                title = TestData.UniqueEntryTitle(),
                prompts = new[] { new { content = "Hello {{name}}" } },
            }
        );
        var entryId = entryBody.GetProperty("id").GetString()!;

        // Create empty dataset (no rows)
        var (datasetResponse, datasetBody) = await Client.PostJsonAsync<JsonElement>(
            $"/api/entries/{entryId}/datasets",
            new { name = "Empty Dataset" }
        );
        var datasetId = datasetBody.GetProperty("id").GetString()!;

        var response = await Client.PostAsJsonAsync(
            $"/api/entries/{entryId}/abtests",
            new
            {
                versionANumber = 1,
                versionBNumber = 1,
                datasetId,
                model = "test-model",
                temperature = 1.0,
                maxTokens = 4096,
            }
        );

        response.StatusCode.Should().Be(HttpStatusCode.UnprocessableEntity);
    }

    [Fact]
    public async Task StartAbTest_VersionNotFound_Returns404()
    {
        var (entryId, datasetId) = await CreateEntryWithDatasetAsync();

        var response = await Client.PostAsJsonAsync(
            $"/api/entries/{entryId}/abtests",
            new
            {
                versionANumber = 1,
                versionBNumber = 99, // doesn't exist
                datasetId,
                model = "test-model",
                temperature = 1.0,
                maxTokens = 4096,
            }
        );

        response.StatusCode.Should().Be(HttpStatusCode.NotFound);
    }

    [Fact]
    public async Task StartAbTest_CrossEntryDataset_ReturnsNotFound()
    {
        // Create entry1 with dataset
        var (entryId1, datasetId) = await CreateEntryWithDatasetAsync();

        // Create a different entry (no dataset)
        var token = await AuthHelper.GetEditorTokenAsync(Client);
        Client.WithBearerToken(token);
        var (_, entry2Body) = await Client.PostJsonAsync<JsonElement>(
            "/api/entries",
            new
            {
                title = TestData.UniqueEntryTitle(),
                prompts = new[] { new { content = "Different {{name}}" } },
            }
        );
        var entryId2 = entry2Body.GetProperty("id").GetString()!;

        // Try to start A/B test on entry2 using entry1's dataset — should be blocked
        var response = await Client.PostAsJsonAsync(
            $"/api/entries/{entryId2}/abtests",
            new
            {
                versionANumber = 1,
                versionBNumber = 1,
                datasetId,
                model = "test-model",
                temperature = 1.0,
                maxTokens = 4096,
            }
        );

        response.StatusCode.Should().Be(HttpStatusCode.NotFound);
    }
}
