using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using FluentAssertions;
using Clarive.Api.IntegrationTests.Fixtures;
using Clarive.Api.IntegrationTests.Helpers;
using Xunit;

namespace Clarive.Api.IntegrationTests.Tests.PublicApi;

[Collection("Integration")]
public class PublicApiTests : IntegrationTestBase
{
    public PublicApiTests(IntegrationTestFixture fixture) : base(fixture) { }

    [Fact]
    public async Task Get_WithValidApiKey_PublishedEntry_Returns200()
    {
        Client.WithApiKey(TestData.ApiKey1);

        // e-001 "Blog Post Generator" is published
        var response = await Client.GetAsync($"/public/v1/entries/{TestData.EntryBlogPostGenerator}");

        response.StatusCode.Should().Be(HttpStatusCode.OK);

        var json = await response.ReadJsonAsync();
        json.GetProperty("id").GetString().Should().Be(TestData.EntryBlogPostGenerator.ToString());
        json.GetProperty("title").GetString().Should().NotBeNullOrEmpty();
        json.GetProperty("version").GetInt32().Should().BeGreaterOrEqualTo(1);
    }

    [Fact]
    public async Task Get_WithoutApiKey_Returns401()
    {
        // No API key header
        var response = await Client.GetAsync($"/public/v1/entries/{TestData.EntryBlogPostGenerator}");

        response.StatusCode.Should().Be(HttpStatusCode.Unauthorized);
    }

    [Fact]
    public async Task Get_DraftOnlyEntry_Returns404()
    {
        Client.WithApiKey(TestData.ApiKey1);

        // e-003 "CSV Summarizer" is draft-only (never published)
        var response = await Client.GetAsync($"/public/v1/entries/{TestData.EntryCsvSummarizer}");

        response.StatusCode.Should().Be(HttpStatusCode.NotFound);
    }

    [Fact]
    public async Task Get_TrashedEntry_Returns404()
    {
        Client.WithApiKey(TestData.ApiKey1);

        // e-009 "Deprecated Summarizer" is trashed
        var response = await Client.GetAsync($"/public/v1/entries/{TestData.EntryDeprecatedSummarizer}");

        response.StatusCode.Should().Be(HttpStatusCode.NotFound);
    }

    [Fact]
    public async Task Generate_WithValidFields_Returns200()
    {
        Client.WithApiKey(TestData.ApiKey1);

        // e-001 "Blog Post Generator" has template fields: tone, topic, audience, wordCount
        var (response, body) = await Client.PostJsonAsync<JsonElement>(
            $"/public/v1/entries/{TestData.EntryBlogPostGenerator}/generate",
            new
            {
                fields = new Dictionary<string, string>
                {
                    ["tone"] = "professional",
                    ["topic"] = "AI testing",
                    ["audience"] = "developers",
                    ["wordCount"] = "500"
                }
            });

        response.StatusCode.Should().Be(HttpStatusCode.OK);
        body.GetProperty("renderedPrompts").GetArrayLength().Should().BeGreaterOrEqualTo(1);

        // Verify template fields were rendered (no {{...}} placeholders remain)
        var firstPromptContent = body.GetProperty("renderedPrompts")[0].GetProperty("content").GetString()!;
        firstPromptContent.Should().Contain("professional");
        firstPromptContent.Should().Contain("AI testing");
    }

    [Fact]
    public async Task Generate_MissingRequiredFields_Returns422()
    {
        Client.WithApiKey(TestData.ApiKey1);

        // e-001 has template fields but we send empty fields dict
        var (response, _) = await Client.PostJsonAsync<JsonElement>(
            $"/public/v1/entries/{TestData.EntryBlogPostGenerator}/generate",
            new
            {
                fields = new Dictionary<string, string>()
            });

        response.StatusCode.Should().Be(HttpStatusCode.UnprocessableEntity);
    }
}
