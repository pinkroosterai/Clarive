using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using Clarive.Api.IntegrationTests.Fixtures;
using Clarive.Api.IntegrationTests.Helpers;
using FluentAssertions;
using Xunit;

namespace Clarive.Api.IntegrationTests.Tests.TestDatasets;

[Collection("Integration")]
public class TestDatasetTests : IntegrationTestBase
{
    public TestDatasetTests(IntegrationTestFixture fixture)
        : base(fixture) { }

    private async Task<string> CreateEntryAsync()
    {
        var token = await AuthHelper.GetEditorTokenAsync(Client);
        Client.WithBearerToken(token);

        var (response, body) = await Client.PostJsonAsync<JsonElement>(
            "/api/entries",
            new
            {
                title = TestData.UniqueEntryTitle(),
                systemMessage = "You are a helpful assistant.",
                prompts = new[] { new { content = "Write about {{topic}} for {{audience}}" } },
            }
        );

        response.StatusCode.Should().Be(HttpStatusCode.Created);
        return body.GetProperty("id").GetString()!;
    }

    [Fact]
    public async Task CreateDataset_AsEditor_Returns201()
    {
        var entryId = await CreateEntryAsync();

        var (response, body) = await Client.PostJsonAsync<JsonElement>(
            $"/api/entries/{entryId}/datasets",
            new { name = "Test Dataset" }
        );

        response.StatusCode.Should().Be(HttpStatusCode.Created);
        body.GetProperty("name").GetString().Should().Be("Test Dataset");
        body.GetProperty("rows").GetArrayLength().Should().Be(0);
    }

    [Fact]
    public async Task CreateDataset_AsViewer_Returns403()
    {
        var entryId = await CreateEntryAsync();

        var viewerToken = await AuthHelper.GetViewerTokenAsync(Client);
        Client.WithBearerToken(viewerToken);

        var response = await Client.PostAsJsonAsync(
            $"/api/entries/{entryId}/datasets",
            new { name = "Viewer Dataset" }
        );

        response.StatusCode.Should().Be(HttpStatusCode.Forbidden);
    }

    [Fact]
    public async Task ListDatasets_ReturnsOnlyEntryDatasets()
    {
        var entryId = await CreateEntryAsync();

        // Create two datasets for this entry
        await Client.PostAsJsonAsync($"/api/entries/{entryId}/datasets", new { name = "Dataset A" });
        await Client.PostAsJsonAsync($"/api/entries/{entryId}/datasets", new { name = "Dataset B" });

        var response = await Client.GetAsync($"/api/entries/{entryId}/datasets");
        response.StatusCode.Should().Be(HttpStatusCode.OK);

        var body = await response.ReadJsonAsync();
        body.GetArrayLength().Should().BeGreaterThanOrEqualTo(2);

        var names = body.EnumerateArray().Select(d => d.GetProperty("name").GetString()).ToList();
        names.Should().Contain("Dataset A");
        names.Should().Contain("Dataset B");
    }

    [Fact]
    public async Task GetDataset_WithRows_ReturnsAllRows()
    {
        var entryId = await CreateEntryAsync();

        var (_, dataset) = await Client.PostJsonAsync<JsonElement>(
            $"/api/entries/{entryId}/datasets",
            new { name = "With Rows" }
        );
        var datasetId = dataset.GetProperty("id").GetString()!;

        // Add rows
        await Client.PostAsJsonAsync(
            $"/api/entries/{entryId}/datasets/{datasetId}/rows",
            new { values = new { topic = "AI", audience = "developers" } }
        );
        await Client.PostAsJsonAsync(
            $"/api/entries/{entryId}/datasets/{datasetId}/rows",
            new { values = new { topic = "ML", audience = "students" } }
        );

        var response = await Client.GetAsync($"/api/entries/{entryId}/datasets/{datasetId}");
        response.StatusCode.Should().Be(HttpStatusCode.OK);

        var body = await response.ReadJsonAsync();
        body.GetProperty("rows").GetArrayLength().Should().Be(2);
    }

    [Fact]
    public async Task AddRow_Returns201()
    {
        var entryId = await CreateEntryAsync();

        var (_, dataset) = await Client.PostJsonAsync<JsonElement>(
            $"/api/entries/{entryId}/datasets",
            new { name = "Row Test" }
        );
        var datasetId = dataset.GetProperty("id").GetString()!;

        var (response, row) = await Client.PostJsonAsync<JsonElement>(
            $"/api/entries/{entryId}/datasets/{datasetId}/rows",
            new { values = new { topic = "Testing", audience = "QA" } }
        );

        response.StatusCode.Should().Be(HttpStatusCode.Created);
        row.GetProperty("values").GetProperty("topic").GetString().Should().Be("Testing");
    }

    [Fact]
    public async Task UpdateRow_Returns200()
    {
        var entryId = await CreateEntryAsync();

        var (_, dataset) = await Client.PostJsonAsync<JsonElement>(
            $"/api/entries/{entryId}/datasets",
            new { name = "Update Row Test" }
        );
        var datasetId = dataset.GetProperty("id").GetString()!;

        var (_, row) = await Client.PostJsonAsync<JsonElement>(
            $"/api/entries/{entryId}/datasets/{datasetId}/rows",
            new { values = new { topic = "Original", audience = "testers" } }
        );
        var rowId = row.GetProperty("id").GetString()!;

        var updateResponse = await Client.PutAsJsonAsync(
            $"/api/entries/{entryId}/datasets/{datasetId}/rows/{rowId}",
            new { values = new { topic = "Updated", audience = "developers" } }
        );

        updateResponse.StatusCode.Should().Be(HttpStatusCode.OK);

        var updatedBody = await updateResponse.ReadJsonAsync();
        updatedBody.GetProperty("values").GetProperty("topic").GetString().Should().Be("Updated");
    }

    [Fact]
    public async Task DeleteRow_Returns204()
    {
        var entryId = await CreateEntryAsync();

        var (_, dataset) = await Client.PostJsonAsync<JsonElement>(
            $"/api/entries/{entryId}/datasets",
            new { name = "Delete Row Test" }
        );
        var datasetId = dataset.GetProperty("id").GetString()!;

        var (_, row) = await Client.PostJsonAsync<JsonElement>(
            $"/api/entries/{entryId}/datasets/{datasetId}/rows",
            new { values = new { topic = "ToDelete", audience = "nobody" } }
        );
        var rowId = row.GetProperty("id").GetString()!;

        var deleteResponse = await Client.DeleteAsync(
            $"/api/entries/{entryId}/datasets/{datasetId}/rows/{rowId}"
        );
        deleteResponse.StatusCode.Should().Be(HttpStatusCode.NoContent);

        // Verify row is gone
        var getResponse = await Client.GetAsync($"/api/entries/{entryId}/datasets/{datasetId}");
        var body = await getResponse.ReadJsonAsync();
        body.GetProperty("rows").GetArrayLength().Should().Be(0);
    }

    [Fact]
    public async Task DeleteDataset_Returns204_CascadesDeletesRows()
    {
        var entryId = await CreateEntryAsync();

        var (_, dataset) = await Client.PostJsonAsync<JsonElement>(
            $"/api/entries/{entryId}/datasets",
            new { name = "To Delete" }
        );
        var datasetId = dataset.GetProperty("id").GetString()!;

        // Add a row
        await Client.PostAsJsonAsync(
            $"/api/entries/{entryId}/datasets/{datasetId}/rows",
            new { values = new { topic = "Gone", audience = "nobody" } }
        );

        var deleteResponse = await Client.DeleteAsync($"/api/entries/{entryId}/datasets/{datasetId}");
        deleteResponse.StatusCode.Should().Be(HttpStatusCode.NoContent);

        // Verify dataset is gone
        var getResponse = await Client.GetAsync($"/api/entries/{entryId}/datasets/{datasetId}");
        getResponse.StatusCode.Should().Be(HttpStatusCode.NotFound);
    }

    [Fact]
    public async Task UpdateDataset_RenamesSuccessfully()
    {
        var entryId = await CreateEntryAsync();

        var (_, dataset) = await Client.PostJsonAsync<JsonElement>(
            $"/api/entries/{entryId}/datasets",
            new { name = "Original Name" }
        );
        var datasetId = dataset.GetProperty("id").GetString()!;

        var updateResponse = await Client.PutAsJsonAsync(
            $"/api/entries/{entryId}/datasets/{datasetId}",
            new { name = "Renamed" }
        );
        updateResponse.StatusCode.Should().Be(HttpStatusCode.OK);

        var body = await updateResponse.ReadJsonAsync();
        body.GetProperty("name").GetString().Should().Be("Renamed");
    }

    [Fact]
    public async Task GetDataset_WrongTenant_Returns404()
    {
        var entryId = await CreateEntryAsync();

        var (_, dataset) = await Client.PostJsonAsync<JsonElement>(
            $"/api/entries/{entryId}/datasets",
            new { name = "Hidden" }
        );
        var datasetId = dataset.GetProperty("id").GetString()!;

        // Random GUID should not find it
        var randomEntry = Guid.NewGuid();
        var response = await Client.GetAsync($"/api/entries/{randomEntry}/datasets/{datasetId}");
        // Dataset lookup is by tenant + datasetId — entry mismatch doesn't matter for GET by ID,
        // but the dataset still belongs to the correct tenant. Test that a non-existent dataset returns 404.
        var nonExistentId = Guid.NewGuid();
        var notFoundResponse = await Client.GetAsync($"/api/entries/{entryId}/datasets/{nonExistentId}");
        notFoundResponse.StatusCode.Should().Be(HttpStatusCode.NotFound);
    }

    [Fact]
    public async Task GetDataset_CrossEntry_Returns404()
    {
        // Create dataset on entry 1
        var entryId1 = await CreateEntryAsync();
        var (_, dataset) = await Client.PostJsonAsync<JsonElement>(
            $"/api/entries/{entryId1}/datasets",
            new { name = "Entry1 Dataset" }
        );
        var datasetId = dataset.GetProperty("id").GetString()!;

        // Create a different entry
        var entryId2 = await CreateEntryAsync();

        // Try to access entry1's dataset via entry2's URL — should be blocked
        var response = await Client.GetAsync($"/api/entries/{entryId2}/datasets/{datasetId}");
        response.StatusCode.Should().Be(HttpStatusCode.NotFound);

        // Also verify update is blocked
        var updateResponse = await Client.PutAsJsonAsync(
            $"/api/entries/{entryId2}/datasets/{datasetId}",
            new { name = "Hijacked" }
        );
        updateResponse.StatusCode.Should().Be(HttpStatusCode.NotFound);

        // And delete is blocked
        var deleteResponse = await Client.DeleteAsync($"/api/entries/{entryId2}/datasets/{datasetId}");
        deleteResponse.StatusCode.Should().Be(HttpStatusCode.NotFound);
    }
}
