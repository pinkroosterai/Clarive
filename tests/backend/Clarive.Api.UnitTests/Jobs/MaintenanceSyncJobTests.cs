using Clarive.Application.Background;
using Clarive.Application.SuperAdmin.Services;
using Clarive.Domain.Entities;
using Clarive.Domain.Interfaces.Repositories;
using FluentAssertions;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging;
using NSubstitute;
using Quartz;

namespace Clarive.Api.UnitTests.Jobs;

public class MaintenanceSyncJobTests
{
    private readonly ISystemConfigRepository _configRepo = Substitute.For<ISystemConfigRepository>();
    private readonly MaintenanceModeService _maintenanceMode = new(Substitute.For<IServiceScopeFactory>());
    private readonly ILogger<MaintenanceSyncJob> _logger = Substitute.For<ILogger<MaintenanceSyncJob>>();
    private readonly IJobExecutionContext _context = Substitute.For<IJobExecutionContext>();
    private readonly MaintenanceSyncJob _sut;

    public MaintenanceSyncJobTests()
    {
        _context.CancellationToken.Returns(CancellationToken.None);
        _sut = new MaintenanceSyncJob(_configRepo, _maintenanceMode, _logger);
    }

    [Fact]
    public void Job_HasDisallowConcurrentExecutionAttribute()
    {
        typeof(MaintenanceSyncJob)
            .GetCustomAttributes(typeof(DisallowConcurrentExecutionAttribute), true)
            .Should()
            .NotBeEmpty();
    }

    [Fact]
    public async Task Execute_WhenConfigExists_SyncsMaintenanceState()
    {
        var config = new SystemConfig { MaintenanceEnabled = true };
        _configRepo.GetAsync(Arg.Any<CancellationToken>()).Returns(config);

        await _sut.Execute(_context);

        _maintenanceMode.IsEnabled.Should().BeTrue();
    }

    [Fact]
    public async Task Execute_WhenConfigIsNull_DoesNotThrow()
    {
        _configRepo.GetAsync(Arg.Any<CancellationToken>()).Returns((SystemConfig?)null);

        var act = () => _sut.Execute(_context);

        await act.Should().NotThrowAsync();
    }

    [Fact]
    public async Task Execute_WhenMaintenanceDisabled_SyncsFalse()
    {
        // First enable, then disable
        _maintenanceMode.SyncFromDb(true);
        _maintenanceMode.IsEnabled.Should().BeTrue();

        var config = new SystemConfig { MaintenanceEnabled = false };
        _configRepo.GetAsync(Arg.Any<CancellationToken>()).Returns(config);

        await _sut.Execute(_context);

        _maintenanceMode.IsEnabled.Should().BeFalse();
    }
}
