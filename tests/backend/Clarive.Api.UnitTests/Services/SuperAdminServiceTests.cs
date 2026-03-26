using Clarive.Auth.Jwt;
using Clarive.Infrastructure.Security;
using Clarive.Domain.Entities;
using Clarive.Domain.Interfaces.Repositories;
using Clarive.Domain.Interfaces.Services;
using FluentAssertions;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;
using NSubstitute;

namespace Clarive.Api.UnitTests.Services;

public class SuperAdminServiceTests
{
    private readonly IPlatformStatsRepository _statsRepo = Substitute.For<IPlatformStatsRepository>();
    private readonly ISuperAdminRepository _adminRepo = Substitute.For<ISuperAdminRepository>();
    private readonly IUserRepository _userRepo = Substitute.For<IUserRepository>();
    private readonly PasswordHasher _passwordHasher = new();
    private readonly IUserWorkspaceCreationService _workspaceCreation = Substitute.For<IUserWorkspaceCreationService>();
    private readonly IUnitOfWork _unitOfWork = Substitute.For<IUnitOfWork>();
    private readonly ITenantMembershipRepository _membershipRepo = Substitute.For<ITenantMembershipRepository>();
    private readonly ITenantRepository _tenantRepo = Substitute.For<ITenantRepository>();
    private readonly ITokenRepository _tokenRepo = Substitute.For<ITokenRepository>();
    private readonly IEmailService _emailService = Substitute.For<IEmailService>();
    private readonly SuperAdminService _sut;

    private static readonly Guid UserId = Guid.NewGuid();

    public SuperAdminServiceTests()
    {
        _userRepo
            .UpdateAsync(Arg.Any<User>(), Arg.Any<CancellationToken>())
            .Returns(ci => ci.Arg<User>());

        var jwtSettings = new JwtSettings
        {
            Secret = "test-secret-key-minimum-32-characters-long-for-hmac-sha256!",
            Issuer = "test",
            Audience = "test",
            ExpirationMinutes = 15,
            RefreshTokenExpirationDays = 7,
        };
        var jwtService = new JwtService(
            new OptionsMonitorStub<JwtSettings>(jwtSettings),
            Substitute.For<ILogger<JwtService>>()
        );

        var config = new ConfigurationBuilder()
            .AddInMemoryCollection(new Dictionary<string, string?> { ["Email:Provider"] = "none" })
            .Build();

        var appSettings = Options.Create(new AppSettings { FrontendUrl = "http://localhost:8080" });

        _sut = new SuperAdminService(
            _statsRepo,
            _adminRepo,
            _userRepo,
            _passwordHasher,
            _workspaceCreation,
            _unitOfWork,
            _membershipRepo,
            _tenantRepo,
            _tokenRepo,
            jwtService,
            _emailService,
            appSettings,
            config
        );
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
        result.FirstError.Code.Should().Be("USER_NOT_FOUND");
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

    // ── HardDeleteUserAsync ──

    [Fact]
    public async Task HardDeleteUserAsync_UserNotFound_ReturnsFalse()
    {
        _userRepo
            .GetByIdCrossTenantsAsync(UserId, Arg.Any<CancellationToken>())
            .Returns((User?)null);

        var result = await _sut.HardDeleteUserAsync(UserId, default);

        result.Should().BeFalse();
    }

    [Fact]
    public async Task HardDeleteUserAsync_Valid_DelegatesToAdminRepo()
    {
        var user = new User { Id = UserId, Email = "user@test.com" };
        _userRepo.GetByIdCrossTenantsAsync(UserId, Arg.Any<CancellationToken>()).Returns(user);

        var result = await _sut.HardDeleteUserAsync(UserId, default);

        result.Should().BeTrue();
        await _adminRepo.Received(1)
            .HardDeleteUserWithMembershipsAsync(user, Arg.Any<CancellationToken>());
    }
}
