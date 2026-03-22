using Clarive.Application.Background;
using Clarive.Domain.Entities;
using Clarive.Domain.Interfaces.Repositories;
using Clarive.Domain.Interfaces.Services;
using FluentAssertions;
using Microsoft.Extensions.Logging;
using NSubstitute;
using Quartz;

namespace Clarive.Api.UnitTests.Jobs;

public class AccountPurgeJobTests
{
    private readonly IAccountPurgeRepository _repo = Substitute.For<IAccountPurgeRepository>();
    private readonly IEmailService _emailService = Substitute.For<IEmailService>();
    private readonly ILogger<AccountPurgeJob> _logger = Substitute.For<ILogger<AccountPurgeJob>>();
    private readonly IJobExecutionContext _context = Substitute.For<IJobExecutionContext>();
    private readonly AccountPurgeJob _sut;

    public AccountPurgeJobTests()
    {
        _context.CancellationToken.Returns(CancellationToken.None);
        _sut = new AccountPurgeJob(_repo, _emailService, _logger);
    }

    [Fact]
    public void Job_HasDisallowConcurrentExecutionAttribute()
    {
        typeof(AccountPurgeJob)
            .GetCustomAttributes(typeof(DisallowConcurrentExecutionAttribute), true)
            .Should()
            .NotBeEmpty();
    }

    [Fact]
    public async Task Execute_NoExpiredAccounts_CompletesWithoutError()
    {
        _repo.GetExpiredTenantsAsync(Arg.Any<int>(), Arg.Any<CancellationToken>())
            .Returns(new List<Tenant>());
        _repo.GetExpiredUsersAsync(Arg.Any<int>(), Arg.Any<CancellationToken>())
            .Returns(new List<User>());

        await _sut.Execute(_context);

        await _repo.Received(1).GetExpiredTenantsAsync(50, Arg.Any<CancellationToken>());
        await _repo.Received(1).GetExpiredUsersAsync(50, Arg.Any<CancellationToken>());
        await _repo.DidNotReceive().RemoveTenantsAsync(Arg.Any<List<Tenant>>(), Arg.Any<CancellationToken>());
        await _repo.DidNotReceive().RemoveUsersAsync(Arg.Any<List<User>>(), Arg.Any<CancellationToken>());
    }

    [Fact]
    public async Task Execute_WithExpiredTenants_PurgesAndSendsEmails()
    {
        var user = new User { Email = "test@example.com", Name = "Test User" };
        var tenant = new Tenant { Id = Guid.NewGuid(), Name = "Test Tenant", Users = [user] };

        _repo.GetExpiredTenantsAsync(Arg.Any<int>(), Arg.Any<CancellationToken>())
            .Returns(new List<Tenant> { tenant }, new List<Tenant>());
        _repo.GetExpiredUsersAsync(Arg.Any<int>(), Arg.Any<CancellationToken>())
            .Returns(new List<User>());

        await _sut.Execute(_context);

        await _repo.Received(1).RemoveTenantsAsync(
            Arg.Is<List<Tenant>>(l => l.Count == 1),
            Arg.Any<CancellationToken>());
        _ = _emailService.Received(1).SendAccountDeletionCompletedAsync(
            "test@example.com",
            "Test User",
            Arg.Any<CancellationToken>());
    }

    [Fact]
    public async Task Execute_WithExpiredUsers_PurgesUsers()
    {
        var user = new User { Id = Guid.NewGuid(), Email = "user@example.com" };

        _repo.GetExpiredTenantsAsync(Arg.Any<int>(), Arg.Any<CancellationToken>())
            .Returns(new List<Tenant>());
        _repo.GetExpiredUsersAsync(Arg.Any<int>(), Arg.Any<CancellationToken>())
            .Returns(new List<User> { user }, new List<User>());

        await _sut.Execute(_context);

        await _repo.Received(1).RemoveUsersAsync(
            Arg.Is<List<User>>(l => l.Count == 1),
            Arg.Any<CancellationToken>());
    }
}
