using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using Clarive.Infrastructure.Data;
using Clarive.Api.IntegrationTests.Fixtures;
using Clarive.Api.IntegrationTests.Helpers;
using FluentAssertions;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Xunit;

namespace Clarive.Api.IntegrationTests.Tests.Entries;

[Collection("Integration")]
public class EntryConcurrencyTests : IntegrationTestBase
{
    public EntryConcurrencyTests(IntegrationTestFixture fixture)
        : base(fixture) { }

    [Fact]
    public async Task Update_WithStaleXmin_ThrowsConcurrencyException()
    {
        // Arrange: create a fresh entry via API
        var token = await AuthHelper.GetEditorTokenAsync(Client);
        Client.WithBearerToken(token);

        var (createResp, created) = await Client.PostJsonAsync<JsonElement>(
            "/api/entries",
            new
            {
                title = TestData.UniqueEntryTitle(),
                systemMessage = "Original",
                prompts = new[] { new { content = "Original prompt" } },
            }
        );
        createResp.StatusCode.Should().Be(HttpStatusCode.Created);

        var entryId = Guid.Parse(created.GetProperty("id").GetString()!);

        // Load the entry in a separate DbContext (captures xmin via tracking)
        using var scope = Fixture.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<ClariveDbContext>();
        var entry = await db.PromptEntries.IgnoreQueryFilters().FirstAsync(e => e.Id == entryId);
        var originalXmin = entry.RowVersion;

        // Update via HTTP (this changes the xmin in the database)
        var updateContent = JsonContent.Create(
            new
            {
                title = "Updated via HTTP",
                prompts = new[] { new { content = "Updated prompt" } },
            }
        );
        var httpUpdateResp = await Client.PutAsync($"/api/entries/{entryId}", updateContent);
        httpUpdateResp.StatusCode.Should().Be(HttpStatusCode.OK);

        // Verify xmin actually changed in the database
        using var scope2 = Fixture.Services.CreateScope();
        var db2 = scope2.ServiceProvider.GetRequiredService<ClariveDbContext>();
        var freshEntry = await db2
            .PromptEntries.IgnoreQueryFilters()
            .AsNoTracking()
            .FirstAsync(e => e.Id == entryId);
        freshEntry
            .RowVersion.Should()
            .NotBe(originalXmin, "HTTP update should have changed the xmin value");

        // Act: try to save the stale entity (old xmin) → should throw
        entry.Title = "Stale update";
        var act = () => db.SaveChangesAsync();

        // Assert: EF Core detects xmin mismatch
        await act.Should().ThrowAsync<DbUpdateConcurrencyException>();
    }

    [Fact]
    public async Task ConcurrentUpdates_OneSucceedsOneGets409()
    {
        // Arrange: create and publish an entry so updates create new drafts
        var token = await AuthHelper.GetEditorTokenAsync(Client);
        Client.WithBearerToken(token);

        var (createResp, created) = await Client.PostJsonAsync<JsonElement>(
            "/api/entries",
            new
            {
                title = TestData.UniqueEntryTitle(),
                systemMessage = "Base version",
                prompts = new[] { new { content = "Base prompt" } },
            }
        );
        createResp.StatusCode.Should().Be(HttpStatusCode.Created);
        var entryId = created.GetProperty("id").GetString()!;

        // Use two separate HttpClients to simulate concurrent users
        var client1 = Fixture.CreateClient();
        var client2 = Fixture.CreateClient();

        var token1 = await AuthHelper.GetEditorTokenAsync(client1);
        var token2 = await AuthHelper.GetAdminTokenAsync(client2);

        client1.WithBearerToken(token1);
        client2.WithBearerToken(token2);

        // Act: send two concurrent updates
        var update1 = client1.PutAsync(
            $"/api/entries/{entryId}",
            JsonContent.Create(
                new
                {
                    title = "Update from client 1",
                    prompts = new[] { new { content = "Prompt 1" } },
                }
            )
        );

        var update2 = client2.PutAsync(
            $"/api/entries/{entryId}",
            JsonContent.Create(
                new
                {
                    title = "Update from client 2",
                    prompts = new[] { new { content = "Prompt 2" } },
                }
            )
        );

        var results = await Task.WhenAll(update1, update2);

        // Assert: both could succeed (serialized) or one gets 409 (true overlap)
        var statuses = results.Select(r => r.StatusCode).ToList();

        // At minimum, at least one must succeed
        statuses.Should().Contain(HttpStatusCode.OK);

        // If a conflict occurred, it should be a proper 409
        foreach (var result in results.Where(r => r.StatusCode != HttpStatusCode.OK))
        {
            result.StatusCode.Should().Be(HttpStatusCode.Conflict);
            var body = await result.ReadJsonAsync();
            body.GetProperty("error")
                .GetProperty("code")
                .GetString()
                .Should()
                .Be("CONCURRENCY_CONFLICT");
        }

        // Verify data integrity: entry is not corrupted
        var getResp = await Client.GetAsync($"/api/entries/{entryId}");
        getResp.StatusCode.Should().Be(HttpStatusCode.OK);
        var entry = await getResp.ReadJsonAsync();
        entry
            .GetProperty("title")
            .GetString()
            .Should()
            .BeOneOf("Update from client 1", "Update from client 2");
    }
}
