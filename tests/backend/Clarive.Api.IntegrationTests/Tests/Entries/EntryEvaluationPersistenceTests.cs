using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using Clarive.Api.IntegrationTests.Fixtures;
using Clarive.Api.IntegrationTests.Helpers;
using FluentAssertions;
using Xunit;

namespace Clarive.Api.IntegrationTests.Tests.Entries;

[Collection("Integration")]
public class EntryEvaluationPersistenceTests : IntegrationTestBase
{
    public EntryEvaluationPersistenceTests(IntegrationTestFixture fixture)
        : base(fixture) { }

    [Fact]
    public async Task Update_WithEvaluation_PersistsScores()
    {
        var token = await AuthHelper.GetEditorTokenAsync(Client);
        Client.WithBearerToken(token);

        // Create entry
        var (_, created) = await Client.PostJsonAsync<JsonElement>(
            "/api/entries",
            new
            {
                title = TestData.UniqueEntryTitle(),
                prompts = new[] { new { content = "Test prompt" } },
            }
        );
        var entryId = created.GetProperty("id").GetString();

        // Update with evaluation
        var content = JsonContent.Create(
            new
            {
                prompts = new[] { new { content = "Test prompt" } },
                evaluation = new Dictionary<string, object>
                {
                    ["Clarity"] = new { score = 8, feedback = "Very clear" },
                    ["Effectiveness"] = new { score = 7, feedback = "Effective" },
                    ["Completeness"] = new { score = 9, feedback = "Complete" },
                    ["Faithfulness"] = new { score = 8, feedback = "Faithful" },
                },
            }
        );
        var response = await Client.PutAsync($"/api/entries/{entryId}", content);
        response.StatusCode.Should().Be(HttpStatusCode.OK);

        // Fetch and verify evaluation persisted
        var getResponse = await Client.GetAsync($"/api/entries/{entryId}");
        getResponse.StatusCode.Should().Be(HttpStatusCode.OK);
        var body = await getResponse.ReadJsonAsync();

        body.GetProperty("evaluation").GetProperty("dimensions").GetProperty("Clarity").GetProperty("score").GetInt32().Should().Be(8);
        body.GetProperty("evaluation").GetProperty("dimensions").GetProperty("Effectiveness").GetProperty("score").GetInt32().Should().Be(7);
        body.GetProperty("evaluationAverageScore").GetDouble().Should().BeApproximately(8.0, 0.5);
        body.GetProperty("evaluatedAt").GetString().Should().NotBeNullOrEmpty();
    }

    [Fact]
    public async Task Update_WithoutEvaluation_PreservesExisting()
    {
        var token = await AuthHelper.GetEditorTokenAsync(Client);
        Client.WithBearerToken(token);

        // Create entry
        var (_, created) = await Client.PostJsonAsync<JsonElement>(
            "/api/entries",
            new
            {
                title = TestData.UniqueEntryTitle(),
                prompts = new[] { new { content = "Test prompt" } },
            }
        );
        var entryId = created.GetProperty("id").GetString();

        // First update: set evaluation
        var content1 = JsonContent.Create(
            new
            {
                prompts = new[] { new { content = "Test prompt" } },
                evaluation = new Dictionary<string, object>
                {
                    ["Clarity"] = new { score = 8, feedback = "Very clear" },
                    ["Effectiveness"] = new { score = 7, feedback = "Effective" },
                    ["Completeness"] = new { score = 9, feedback = "Complete" },
                    ["Faithfulness"] = new { score = 8, feedback = "Faithful" },
                },
            }
        );
        await Client.PutAsync($"/api/entries/{entryId}", content1);

        // Second update: only change title (no evaluation field)
        var content2 = JsonContent.Create(new { title = "Updated Title Only" });
        await Client.PutAsync($"/api/entries/{entryId}", content2);

        // Fetch and verify evaluation preserved
        var getResponse = await Client.GetAsync($"/api/entries/{entryId}");
        var body = await getResponse.ReadJsonAsync();

        body.GetProperty("title").GetString().Should().Be("Updated Title Only");
        body.GetProperty("evaluation").GetProperty("dimensions").GetProperty("Clarity").GetProperty("score").GetInt32().Should().Be(8);
    }

    [Fact]
    public async Task VersionHistory_IncludesEvaluationData()
    {
        var token = await AuthHelper.GetEditorTokenAsync(Client);
        Client.WithBearerToken(token);

        // Create entry with evaluation
        var (_, created) = await Client.PostJsonAsync<JsonElement>(
            "/api/entries",
            new
            {
                title = TestData.UniqueEntryTitle(),
                prompts = new[] { new { content = "Test prompt" } },
            }
        );
        var entryId = created.GetProperty("id").GetString();

        // Set evaluation
        var content = JsonContent.Create(
            new
            {
                prompts = new[] { new { content = "Test prompt" } },
                evaluation = new Dictionary<string, object>
                {
                    ["Clarity"] = new { score = 8, feedback = "Very clear" },
                    ["Effectiveness"] = new { score = 7, feedback = "Effective" },
                    ["Completeness"] = new { score = 9, feedback = "Complete" },
                    ["Faithfulness"] = new { score = 8, feedback = "Faithful" },
                },
            }
        );
        await Client.PutAsync($"/api/entries/{entryId}", content);

        // Get version history
        var versionsResponse = await Client.GetAsync($"/api/entries/{entryId}/versions");
        versionsResponse.StatusCode.Should().Be(HttpStatusCode.OK);
        var versions = await versionsResponse.ReadJsonAsync();

        var tabVersion = versions.EnumerateArray().First(v => v.GetProperty("versionState").GetString() == "tab");
        tabVersion.GetProperty("evaluationAverageScore").GetDouble().Should().BeGreaterThan(0);
    }
}
