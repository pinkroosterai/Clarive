using Xunit;

namespace Clarive.Api.IntegrationTests.Fixtures;

[CollectionDefinition("Integration")]
public class IntegrationTestCollection : ICollectionFixture<IntegrationTestFixture>;
