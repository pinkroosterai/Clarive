using System.Net;
using System.Net.Http.Json;
using FluentAssertions;
using Clarive.Api.IntegrationTests.Fixtures;
using Clarive.Api.IntegrationTests.Helpers;
using Xunit;

namespace Clarive.Api.IntegrationTests.Tests.Account;

[Collection("Integration")]
public class AccountDeletionTests : IntegrationTestBase
{
    public AccountDeletionTests(IntegrationTestFixture fixture) : base(fixture) { }

    [Fact]
    public async Task DeleteAccount_WithoutConfirmation_Returns422()
    {
        // Register a fresh user to avoid affecting seed data
        var email = TestData.UniqueEmail();
        var registerResponse = await Client.PostAsJsonAsync("/api/auth/register", new
        {
            email,
            password = "TestPassword123!",
            name = "Delete Test"
        });
        registerResponse.StatusCode.Should().Be(HttpStatusCode.Created);
        var regJson = await registerResponse.ReadJsonAsync();
        var token = regJson.GetProperty("token").GetString()!;
        Client.WithBearerToken(token);

        // Try without proper confirmation
        var response = await Client.PostAsJsonAsync("/api/account/delete", new
        {
            confirmation = "wrong"
        });

        response.StatusCode.Should().Be(HttpStatusCode.UnprocessableEntity);
    }

    [Fact]
    public async Task DeleteAccount_WithValidConfirmation_SchedulesDeletion()
    {
        // Register a fresh user
        var email = TestData.UniqueEmail();
        var registerResponse = await Client.PostAsJsonAsync("/api/auth/register", new
        {
            email,
            password = "TestPassword123!",
            name = "Delete Test User"
        });
        registerResponse.StatusCode.Should().Be(HttpStatusCode.Created);
        var regJson = await registerResponse.ReadJsonAsync();
        var token = regJson.GetProperty("token").GetString()!;
        Client.WithBearerToken(token);

        // Schedule deletion
        var response = await Client.PostAsJsonAsync("/api/account/delete", new
        {
            confirmation = "DELETE"
        });

        response.StatusCode.Should().Be(HttpStatusCode.OK);
    }

    [Fact]
    public async Task CancelDeletion_ReturnsOk()
    {
        // Register a fresh user
        var email = TestData.UniqueEmail();
        var registerResponse = await Client.PostAsJsonAsync("/api/auth/register", new
        {
            email,
            password = "TestPassword123!",
            name = "Cancel Delete Test"
        });
        registerResponse.StatusCode.Should().Be(HttpStatusCode.Created);
        var regJson = await registerResponse.ReadJsonAsync();
        var token = regJson.GetProperty("token").GetString()!;
        Client.WithBearerToken(token);

        // Schedule deletion first
        await Client.PostAsJsonAsync("/api/account/delete", new
        {
            confirmation = "DELETE"
        });

        // Cancel deletion
        var cancelResponse = await Client.PostAsJsonAsync("/api/account/cancel-deletion", new { });
        cancelResponse.StatusCode.Should().Be(HttpStatusCode.OK);

        // Verify account is still accessible after cancellation
        var profileResponse = await Client.GetAsync("/api/profile/me");
        profileResponse.StatusCode.Should().Be(HttpStatusCode.OK);
    }

    [Fact]
    public async Task DeleteAccount_Unauthenticated_Returns401()
    {
        Client.DefaultRequestHeaders.Authorization = null;
        var response = await Client.PostAsJsonAsync("/api/account/delete", new
        {
            confirmation = "DELETE"
        });

        response.StatusCode.Should().Be(HttpStatusCode.Unauthorized);
    }
}
