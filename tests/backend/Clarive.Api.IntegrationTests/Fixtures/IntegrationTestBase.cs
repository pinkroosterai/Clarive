using Clarive.Api.IntegrationTests.Helpers;
using Xunit;

namespace Clarive.Api.IntegrationTests.Fixtures;

[Collection("Integration")]
public abstract class IntegrationTestBase
{
    protected readonly IntegrationTestFixture Fixture;
    protected readonly HttpClient Client;

    protected IntegrationTestBase(IntegrationTestFixture fixture)
    {
        Fixture = fixture;
        Client = fixture.CreateClient();
        TestEmailService.Reset();
    }
}
