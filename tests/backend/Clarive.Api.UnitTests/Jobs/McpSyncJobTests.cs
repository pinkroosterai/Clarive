using Clarive.Application.Background;
using Clarive.Application.McpServers.Contracts;
using Clarive.Domain.Entities;
using Clarive.Domain.Interfaces.Repositories;
using FluentAssertions;
using Microsoft.Extensions.Logging;
using NSubstitute;
using NSubstitute.ExceptionExtensions;
using Quartz;

namespace Clarive.Api.UnitTests.Jobs;

public class McpSyncJobTests
{
    private readonly IMcpServerRepository _serverRepo = Substitute.For<IMcpServerRepository>();
    private readonly IMcpServerService _serverService = Substitute.For<IMcpServerService>();
    private readonly ILogger<McpSyncJob> _logger = Substitute.For<ILogger<McpSyncJob>>();
    private readonly IJobExecutionContext _context = Substitute.For<IJobExecutionContext>();
    private readonly McpSyncJob _sut;

    public McpSyncJobTests()
    {
        _context.CancellationToken.Returns(CancellationToken.None);
        _sut = new McpSyncJob(_serverRepo, _serverService, _logger);
    }

    [Fact]
    public void Job_HasDisallowConcurrentExecutionAttribute()
    {
        typeof(McpSyncJob)
            .GetCustomAttributes(typeof(DisallowConcurrentExecutionAttribute), true)
            .Should()
            .NotBeEmpty();
    }

    [Fact]
    public async Task Execute_NoServersDue_ReturnsEarly()
    {
        _serverRepo.GetDueForSyncAsync(Arg.Any<CancellationToken>())
            .Returns(new List<McpServer>());

        await _sut.Execute(_context);

        await _serverService.DidNotReceive()
            .SyncAsync(Arg.Any<Guid>(), Arg.Any<Guid>(), Arg.Any<CancellationToken>());
    }

    [Fact]
    public async Task Execute_WithDueServers_SyncsEach()
    {
        var tenantId = Guid.NewGuid();
        var servers = new List<McpServer>
        {
            new() { Id = Guid.NewGuid(), TenantId = tenantId, Name = "Server1" },
            new() { Id = Guid.NewGuid(), TenantId = tenantId, Name = "Server2" },
        };
        _serverRepo.GetDueForSyncAsync(Arg.Any<CancellationToken>()).Returns(servers);

        await _sut.Execute(_context);

        await _serverService.Received(1).SyncAsync(tenantId, servers[0].Id, Arg.Any<CancellationToken>());
        await _serverService.Received(1).SyncAsync(tenantId, servers[1].Id, Arg.Any<CancellationToken>());
    }

    [Fact]
    public async Task Execute_OneServerFails_ContinuesSyncingOthers()
    {
        var tenantId = Guid.NewGuid();
        var server1 = new McpServer { Id = Guid.NewGuid(), TenantId = tenantId, Name = "FailServer" };
        var server2 = new McpServer { Id = Guid.NewGuid(), TenantId = tenantId, Name = "OkServer" };
        var servers = new List<McpServer> { server1, server2 };

        _serverRepo.GetDueForSyncAsync(Arg.Any<CancellationToken>()).Returns(servers);
        _serverService.SyncAsync(tenantId, server1.Id, Arg.Any<CancellationToken>())
            .ThrowsAsync(new InvalidOperationException("Connection failed"));

        // Should not throw — individual failures are caught
        var act = () => _sut.Execute(_context);
        await act.Should().NotThrowAsync();

        // Second server should still be synced
        await _serverService.Received(1).SyncAsync(tenantId, server2.Id, Arg.Any<CancellationToken>());
    }
}
