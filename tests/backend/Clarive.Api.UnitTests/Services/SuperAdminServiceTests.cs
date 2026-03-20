using Clarive.Infrastructure.Security;
using Clarive.Core.Helpers;
using Clarive.Infrastructure.Data;
using Clarive.Domain.Entities;
using Clarive.Domain.Interfaces.Repositories;
using Clarive.Core.Services;
using FluentAssertions;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Diagnostics;
using NSubstitute;

namespace Clarive.Api.UnitTests.Services;

public class SuperAdminServiceTests : IDisposable
{
    private readonly IUserRepository _userRepo = Substitute.For<IUserRepository>();
    private readonly PasswordHasher _passwordHasher = new();
    private readonly ClariveDbContext _db;
    private readonly SuperAdminService _sut;

    private static readonly Guid UserId = Guid.NewGuid();

    public SuperAdminServiceTests()
    {
        var options = new DbContextOptionsBuilder<ClariveDbContext>()
            .UseInMemoryDatabase(Guid.NewGuid().ToString())
            .ConfigureWarnings(w => w.Ignore(InMemoryEventId.TransactionIgnoredWarning))
            .Options;
        _db = new ClariveDbContext(options);

        _userRepo
            .UpdateAsync(Arg.Any<User>(), Arg.Any<CancellationToken>())
            .Returns(ci => ci.Arg<User>());

        _sut = new SuperAdminService(_db, _userRepo, _passwordHasher);
    }

    public void Dispose()
    {
        _db.Dispose();
        GC.SuppressFinalize(this);
    }

    // ── SoftDeleteUserAsync ──

    [Fact]
    public async Task SoftDeleteUserAsync_UserNotFound_ReturnsFalse()
    {
        _userRepo
            .GetByIdCrossTenantsAsync(UserId, Arg.Any<CancellationToken>())
            .Returns((User?)null);

        var result = await _sut.SoftDeleteUserAsync(UserId, default);

        result.Should().BeFalse();
    }

    [Fact]
    public async Task SoftDeleteUserAsync_Valid_SetsDeleteScheduledAt()
    {
        var user = new User { Id = UserId, Email = "user@test.com" };
        _userRepo.GetByIdCrossTenantsAsync(UserId, Arg.Any<CancellationToken>()).Returns(user);

        var before = DateTime.UtcNow;
        var result = await _sut.SoftDeleteUserAsync(UserId, default);

        result.Should().BeTrue();
        user.DeleteScheduledAt.Should().NotBeNull();
        user.DeleteScheduledAt.Should().BeOnOrAfter(before);
        await _userRepo.Received(1).UpdateAsync(user, Arg.Any<CancellationToken>());
    }

    // ── ResetUserPasswordAsync ──

    [Fact]
    public async Task ResetUserPasswordAsync_UserNotFound_ReturnsNotFound()
    {
        _userRepo
            .GetByIdCrossTenantsAsync(UserId, Arg.Any<CancellationToken>())
            .Returns((User?)null);

        var result = await _sut.ResetUserPasswordAsync(UserId, default);

        result.IsError.Should().BeTrue();
        result.FirstError.Code.Should().Be("NOT_FOUND");
    }

    [Fact]
    public async Task ResetUserPasswordAsync_GoogleAccount_ReturnsValidationError()
    {
        _userRepo
            .GetByIdCrossTenantsAsync(UserId, Arg.Any<CancellationToken>())
            .Returns(new User { Id = UserId, GoogleId = "google123" });

        var result = await _sut.ResetUserPasswordAsync(UserId, default);

        result.IsError.Should().BeTrue();
        result.FirstError.Code.Should().Be("GOOGLE_ACCOUNT");
    }

    [Fact]
    public async Task ResetUserPasswordAsync_Valid_ReturnsPasswordAndUpdatesHash()
    {
        var user = new User
        {
            Id = UserId,
            Email = "user@test.com",
            PasswordHash = "old-hash",
        };
        _userRepo.GetByIdCrossTenantsAsync(UserId, Arg.Any<CancellationToken>()).Returns(user);

        var result = await _sut.ResetUserPasswordAsync(UserId, default);

        result.IsError.Should().BeFalse();
        var password = result.Value;
        password.Should().HaveLength(16);
        _passwordHasher.Verify(password, user.PasswordHash).Should().BeTrue();
        await _userRepo.Received(1).UpdateAsync(user, Arg.Any<CancellationToken>());
    }

    [Fact]
    public async Task ResetUserPasswordAsync_GeneratesUniquePasswords()
    {
        var user = new User { Id = UserId, Email = "user@test.com" };
        _userRepo.GetByIdCrossTenantsAsync(UserId, Arg.Any<CancellationToken>()).Returns(user);

        var password1 = (await _sut.ResetUserPasswordAsync(UserId, default)).Value;
        var password2 = (await _sut.ResetUserPasswordAsync(UserId, default)).Value;

        password1.Should().NotBe(password2);
    }
}
