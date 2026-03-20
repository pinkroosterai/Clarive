using FluentAssertions;

namespace Clarive.Api.UnitTests.Services;

public class MaintenanceModeServiceTests
{
    [Fact]
    public void IsEnabled_DefaultsFalse()
    {
        var sut = new MaintenanceModeService(null!);
        sut.IsEnabled.Should().BeFalse();
    }

    [Fact]
    public void SyncFromDb_True_SetsIsEnabled()
    {
        var sut = new MaintenanceModeService(null!);

        sut.SyncFromDb(true);

        sut.IsEnabled.Should().BeTrue();
    }

    [Fact]
    public void SyncFromDb_False_ClearsIsEnabled()
    {
        var sut = new MaintenanceModeService(null!);
        sut.SyncFromDb(true);

        sut.SyncFromDb(false);

        sut.IsEnabled.Should().BeFalse();
    }

    [Fact]
    public void SyncFromDb_MultipleToggles_ReflectsLatestState()
    {
        var sut = new MaintenanceModeService(null!);

        sut.SyncFromDb(true);
        sut.SyncFromDb(false);
        sut.SyncFromDb(true);

        sut.IsEnabled.Should().BeTrue();
    }
}
