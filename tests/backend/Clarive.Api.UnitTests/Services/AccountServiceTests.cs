using Clarive.Domain.Interfaces.Services;
using Clarive.Auth.Google;
using Clarive.Auth.Jwt;
using Clarive.Infrastructure.Security;
using Clarive.Infrastructure.Data;
using Clarive.Domain.Entities;
using Clarive.Domain.Enums;
using Clarive.Domain.Interfaces.Repositories;
using FluentAssertions;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Diagnostics;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Options;
using NSubstitute;

namespace Clarive.Api.UnitTests.Services;

public class AccountServiceTests : IDisposable
{
    private readonly IUserRepository _userRepo = Substitute.For<IUserRepository>();
    private readonly ITenantRepository _tenantRepo = Substitute.For<ITenantRepository>();
    private readonly ITenantMembershipRepository _membershipRepo =
        Substitute.For<ITenantMembershipRepository>();
    private readonly IRefreshTokenRepository _refreshTokenRepo =
        Substitute.For<IRefreshTokenRepository>();
    private readonly ITokenRepository _tokenRepo = Substitute.For<ITokenRepository>();
    private readonly IInvitationRepository _invitationRepo =
        Substitute.For<IInvitationRepository>();
    private readonly IOnboardingSeeder _onboardingSeeder = Substitute.For<IOnboardingSeeder>();
    private readonly IGoogleAuthService _googleAuth = Substitute.For<IGoogleAuthService>();
    private readonly JwtService _jwtService;
    private readonly PasswordHasher _passwordHasher = new();
    private readonly IConfiguration _configuration;
    private readonly ClariveDbContext _db;
    private readonly AccountService _sut;

    public AccountServiceTests()
    {
        var options = new DbContextOptionsBuilder<ClariveDbContext>()
            .UseInMemoryDatabase(Guid.NewGuid().ToString())
            .ConfigureWarnings(w => w.Ignore(InMemoryEventId.TransactionIgnoredWarning))
            .Options;
        _db = new ClariveDbContext(options);

        var jwtSettings = new JwtSettings
        {
            Secret = "this-is-a-test-secret-key-that-is-at-least-32-bytes-long!",
            Issuer = "test",
            Audience = "test",
            ExpirationMinutes = 15,
            RefreshTokenExpirationDays = 7,
        };
        _jwtService = new JwtService(new OptionsMonitorStub<JwtSettings>(jwtSettings));

        _configuration = new ConfigurationBuilder()
            .AddInMemoryCollection(new Dictionary<string, string?> { ["Email:Provider"] = "none" })
            .Build();

        // Default repo behaviors — return what's passed in
        _userRepo
            .CreateAsync(Arg.Any<User>(), Arg.Any<CancellationToken>())
            .Returns(ci => ci.Arg<User>());
        _tenantRepo
            .CreateAsync(Arg.Any<Tenant>(), Arg.Any<CancellationToken>())
            .Returns(ci => ci.Arg<Tenant>());
        _membershipRepo
            .CreateAsync(Arg.Any<TenantMembership>(), Arg.Any<CancellationToken>())
            .Returns(ci => ci.Arg<TenantMembership>());
        _refreshTokenRepo
            .CreateAsync(Arg.Any<RefreshToken>(), Arg.Any<CancellationToken>())
            .Returns(ci => ci.Arg<RefreshToken>());

        _sut = new AccountService(
            _userRepo,
            _tenantRepo,
            _membershipRepo,
            _refreshTokenRepo,
            _tokenRepo,
            _invitationRepo,
            _onboardingSeeder,
            _googleAuth,
            _jwtService,
            _passwordHasher,
            _configuration,
            _db
        );
    }

    public void Dispose()
    {
        _db.Dispose();
        GC.SuppressFinalize(this);
    }

    // ── Register ──

    [Fact]
    public async Task RegisterAsync_DuplicateEmail_ReturnsConflict()
    {
        _userRepo
            .GetByEmailAsync("existing@test.com", Arg.Any<CancellationToken>())
            .Returns(new User { Email = "existing@test.com" });

        var result = await _sut.RegisterAsync("existing@test.com", "Test", "Password1!", default);

        result.IsError.Should().BeTrue();
        result.FirstError.Code.Should().Be("EMAIL_ALREADY_EXISTS");
    }

    [Fact]
    public async Task RegisterAsync_FirstUser_IsSuperAndAutoVerified()
    {
        _userRepo
            .GetByEmailAsync(Arg.Any<string>(), Arg.Any<CancellationToken>())
            .Returns((User?)null);
        _userRepo.AnyUsersExistAsync(Arg.Any<CancellationToken>()).Returns(false);

        var result = await _sut.RegisterAsync(
            "first@test.com",
            "First User",
            "Password1!",
            default
        );

        result.IsError.Should().BeFalse();
        result.Value.User.IsSuperUser.Should().BeTrue();
        result.Value.User.EmailVerified.Should().BeTrue();
        result.Value.RawVerificationToken.Should().BeNull();
        result.Value.AccessToken.Should().NotBeNullOrEmpty();
        result.Value.RawRefreshToken.Should().StartWith("rt_");
    }

    [Fact]
    public async Task RegisterAsync_NonFirstUser_NoEmailProvider_AutoVerified()
    {
        _userRepo
            .GetByEmailAsync(Arg.Any<string>(), Arg.Any<CancellationToken>())
            .Returns((User?)null);
        _userRepo.AnyUsersExistAsync(Arg.Any<CancellationToken>()).Returns(true);

        var result = await _sut.RegisterAsync("second@test.com", "Second", "Password1!", default);

        result.IsError.Should().BeFalse();
        result.Value.User.IsSuperUser.Should().BeFalse();
        result.Value.User.EmailVerified.Should().BeTrue();
        result.Value.RawVerificationToken.Should().BeNull();
    }

    [Fact]
    public async Task RegisterAsync_WithEmailProvider_CreatesVerificationToken()
    {
        var config = new ConfigurationBuilder()
            .AddInMemoryCollection(
                new Dictionary<string, string?> { ["Email:Provider"] = "resend" }
            )
            .Build();

        var sut = new AccountService(
            _userRepo,
            _tenantRepo,
            _membershipRepo,
            _refreshTokenRepo,
            _tokenRepo,
            _invitationRepo,
            _onboardingSeeder,
            _googleAuth,
            _jwtService,
            _passwordHasher,
            config,
            _db
        );

        _userRepo
            .GetByEmailAsync(Arg.Any<string>(), Arg.Any<CancellationToken>())
            .Returns((User?)null);
        _userRepo.AnyUsersExistAsync(Arg.Any<CancellationToken>()).Returns(true);

        var result = await sut.RegisterAsync("verify@test.com", "Verify", "Password1!", default);

        result.IsError.Should().BeFalse();
        result.Value.RawVerificationToken.Should().NotBeNullOrEmpty();
        await _tokenRepo
            .Received(1)
            .CreateVerificationTokenAsync(
                Arg.Any<EmailVerificationToken>(),
                Arg.Any<CancellationToken>()
            );
    }

    [Fact]
    public async Task RegisterAsync_CreatesWorkspaceAndSeeds()
    {
        _userRepo
            .GetByEmailAsync(Arg.Any<string>(), Arg.Any<CancellationToken>())
            .Returns((User?)null);
        _userRepo.AnyUsersExistAsync(Arg.Any<CancellationToken>()).Returns(false);

        var result = await _sut.RegisterAsync("new@test.com", "New User", "Password1!", default);

        result.IsError.Should().BeFalse();
        result.Value.PersonalWorkspace.Should().NotBeNull();
        result.Value.PersonalWorkspace.Name.Should().Contain("New User");
        await _onboardingSeeder
            .Received(1)
            .SeedStarterTemplatesAsync(
                Arg.Any<Guid>(),
                Arg.Any<Guid>(),
                Arg.Any<CancellationToken>()
            );
    }

    // ── Google Auth ──

    [Fact]
    public async Task LoginWithGoogleAsync_ExistingGoogleId_ReturnsUser()
    {
        var user = new User
        {
            Id = Guid.NewGuid(),
            GoogleId = "google123",
            Email = "g@test.com",
        };
        _googleAuth
            .ValidateIdTokenAsync("token", Arg.Any<string?>(), Arg.Any<CancellationToken>())
            .Returns(new GoogleUserInfo("google123", "g@test.com", "Google User"));
        _userRepo.GetByGoogleIdAsync("google123", Arg.Any<CancellationToken>()).Returns(user);

        var result = await _sut.LoginWithGoogleAsync("token", default);

        result.IsError.Should().BeFalse();
        result.Value.User.Should().BeSameAs(user);
        result.Value.IsNewUser.Should().BeFalse();
        result.Value.AccessToken.Should().NotBeNullOrEmpty();
        result.Value.RawRefreshToken.Should().StartWith("rt_");
    }

    [Fact]
    public async Task LoginWithGoogleAsync_ExistingEmail_NoGoogleId_ReturnsConflict()
    {
        _googleAuth
            .ValidateIdTokenAsync("token", Arg.Any<string?>(), Arg.Any<CancellationToken>())
            .Returns(new GoogleUserInfo("google123", "existing@test.com", "User"));
        _userRepo
            .GetByGoogleIdAsync("google123", Arg.Any<CancellationToken>())
            .Returns((User?)null);
        _userRepo
            .GetByEmailAsync("existing@test.com", Arg.Any<CancellationToken>())
            .Returns(new User { Email = "existing@test.com" });

        var result = await _sut.LoginWithGoogleAsync("token", default);

        result.IsError.Should().BeTrue();
        result.FirstError.Code.Should().Be("EMAIL_CONFLICT");
    }

    [Fact]
    public async Task LoginWithGoogleAsync_NewUser_CreatesAccount()
    {
        _googleAuth
            .ValidateIdTokenAsync("token", Arg.Any<string?>(), Arg.Any<CancellationToken>())
            .Returns(new GoogleUserInfo("google123", "new@test.com", "New User"));
        _userRepo
            .GetByGoogleIdAsync("google123", Arg.Any<CancellationToken>())
            .Returns((User?)null);
        _userRepo
            .GetByEmailAsync("new@test.com", Arg.Any<CancellationToken>())
            .Returns((User?)null);

        var result = await _sut.LoginWithGoogleAsync("token", default);

        result.IsError.Should().BeFalse();
        result.Value.IsNewUser.Should().BeTrue();
        result.Value.User.GoogleId.Should().Be("google123");
        result.Value.User.EmailVerified.Should().BeTrue();
        result.Value.AccessToken.Should().NotBeNullOrEmpty();
    }

    // ── Login ──

    [Fact]
    public async Task LoginAsync_InvalidCredentials_ReturnsUnauthorized()
    {
        _userRepo
            .GetByEmailAsync("user@test.com", Arg.Any<CancellationToken>())
            .Returns((User?)null);

        var result = await _sut.LoginAsync("user@test.com", "password", default);

        result.IsError.Should().BeTrue();
        result.FirstError.Code.Should().Be("INVALID_CREDENTIALS");
    }

    [Fact]
    public async Task LoginAsync_WrongPassword_ReturnsUnauthorized()
    {
        _userRepo
            .GetByEmailAsync("user@test.com", Arg.Any<CancellationToken>())
            .Returns(
                new User
                {
                    Id = Guid.NewGuid(),
                    Email = "user@test.com",
                    PasswordHash = _passwordHasher.Hash("correct-password"),
                    Role = UserRole.Admin,
                    TenantId = Guid.NewGuid(),
                }
            );

        var result = await _sut.LoginAsync("user@test.com", "wrong-password", default);

        result.IsError.Should().BeTrue();
        result.FirstError.Code.Should().Be("INVALID_CREDENTIALS");
    }

    [Fact]
    public async Task LoginAsync_ValidCredentials_ReturnsTokens()
    {
        var userId = Guid.NewGuid();
        _userRepo
            .GetByEmailAsync("user@test.com", Arg.Any<CancellationToken>())
            .Returns(
                new User
                {
                    Id = userId,
                    Email = "user@test.com",
                    Name = "Test User",
                    PasswordHash = _passwordHasher.Hash("Password1!"),
                    Role = UserRole.Admin,
                    TenantId = Guid.NewGuid(),
                }
            );

        var result = await _sut.LoginAsync("user@test.com", "Password1!", default);

        result.IsError.Should().BeFalse();
        result.Value.User.Email.Should().Be("user@test.com");
        result.Value.AccessToken.Should().NotBeNullOrEmpty();
        result.Value.RawRefreshToken.Should().StartWith("rt_");
        await _refreshTokenRepo
            .Received(1)
            .CreateAsync(Arg.Any<RefreshToken>(), Arg.Any<CancellationToken>());
    }

    // ── Refresh Tokens ──

    [Fact]
    public async Task RefreshTokensAsync_MissingToken_ReturnsUnauthorized()
    {
        _refreshTokenRepo
            .GetByHashAsync(Arg.Any<string>(), Arg.Any<CancellationToken>())
            .Returns((RefreshToken?)null);

        var result = await _sut.RefreshTokensAsync("rt_invalid", default);

        result.IsError.Should().BeTrue();
        result.FirstError.Code.Should().Be("INVALID_REFRESH_TOKEN");
    }

    [Fact]
    public async Task RefreshTokensAsync_RevokedToken_ReturnsUnauthorized()
    {
        _refreshTokenRepo
            .GetByHashAsync(Arg.Any<string>(), Arg.Any<CancellationToken>())
            .Returns(
                new RefreshToken
                {
                    Id = Guid.NewGuid(),
                    RevokedAt = DateTime.UtcNow.AddMinutes(-5),
                    ExpiresAt = DateTime.UtcNow.AddDays(7),
                }
            );

        var result = await _sut.RefreshTokensAsync("rt_revoked", default);

        result.IsError.Should().BeTrue();
        result.FirstError.Code.Should().Be("INVALID_REFRESH_TOKEN");
    }

    [Fact]
    public async Task RefreshTokensAsync_ExpiredToken_ReturnsUnauthorized()
    {
        _refreshTokenRepo
            .GetByHashAsync(Arg.Any<string>(), Arg.Any<CancellationToken>())
            .Returns(
                new RefreshToken { Id = Guid.NewGuid(), ExpiresAt = DateTime.UtcNow.AddDays(-1) }
            );

        var result = await _sut.RefreshTokensAsync("rt_expired", default);

        result.IsError.Should().BeTrue();
        result.FirstError.Code.Should().Be("INVALID_REFRESH_TOKEN");
    }

    [Fact]
    public async Task RefreshTokensAsync_ValidToken_RotatesAndReturnsNewTokens()
    {
        var userId = Guid.NewGuid();
        var tenantId = Guid.NewGuid();
        var oldTokenId = Guid.NewGuid();

        _refreshTokenRepo
            .GetByHashAsync(Arg.Any<string>(), Arg.Any<CancellationToken>())
            .Returns(
                new RefreshToken
                {
                    Id = oldTokenId,
                    UserId = userId,
                    ExpiresAt = DateTime.UtcNow.AddDays(7),
                }
            );

        _userRepo
            .GetByIdCrossTenantsAsync(userId, Arg.Any<CancellationToken>())
            .Returns(
                new User
                {
                    Id = userId,
                    TenantId = tenantId,
                    Email = "user@test.com",
                    Name = "User",
                    Role = UserRole.Admin,
                }
            );

        _membershipRepo
            .GetAsync(userId, tenantId, Arg.Any<CancellationToken>())
            .Returns(
                new TenantMembership
                {
                    UserId = userId,
                    TenantId = tenantId,
                    Role = UserRole.Admin,
                }
            );

        var result = await _sut.RefreshTokensAsync("rt_valid", default);

        result.IsError.Should().BeFalse();
        result.Value.AccessToken.Should().NotBeNullOrEmpty();
        result.Value.RawRefreshToken.Should().StartWith("rt_");
        await _refreshTokenRepo
            .Received(1)
            .RevokeAsync(oldTokenId, Arg.Any<Guid?>(), Arg.Any<CancellationToken>());
        await _refreshTokenRepo
            .Received(1)
            .CreateAsync(Arg.Any<RefreshToken>(), Arg.Any<CancellationToken>());
    }

    [Fact]
    public async Task RefreshTokensAsync_MembershipRevoked_FallsBackToPersonal()
    {
        var userId = Guid.NewGuid();
        var tenantId = Guid.NewGuid();
        var personalTenantId = Guid.NewGuid();

        _refreshTokenRepo
            .GetByHashAsync(Arg.Any<string>(), Arg.Any<CancellationToken>())
            .Returns(
                new RefreshToken
                {
                    Id = Guid.NewGuid(),
                    UserId = userId,
                    ExpiresAt = DateTime.UtcNow.AddDays(7),
                }
            );

        var user = new User
        {
            Id = userId,
            TenantId = tenantId,
            Email = "user@test.com",
            Name = "User",
            Role = UserRole.Editor,
        };
        _userRepo.GetByIdCrossTenantsAsync(userId, Arg.Any<CancellationToken>()).Returns(user);

        // Active membership revoked
        _membershipRepo
            .GetAsync(userId, tenantId, Arg.Any<CancellationToken>())
            .Returns((TenantMembership?)null);

        // Has personal workspace
        _membershipRepo
            .GetByUserIdAsync(userId, Arg.Any<CancellationToken>())
            .Returns([
                new TenantMembership
                {
                    UserId = userId,
                    TenantId = personalTenantId,
                    Role = UserRole.Admin,
                    IsPersonal = true,
                },
            ]);

        var result = await _sut.RefreshTokensAsync("rt_valid", default);

        result.IsError.Should().BeFalse();
        user.TenantId.Should().Be(personalTenantId);
        await _userRepo.Received(1).UpdateAsync(user, Arg.Any<CancellationToken>());
    }

    [Fact]
    public async Task RefreshTokensAsync_RoleDrift_SyncsFromMembership()
    {
        var userId = Guid.NewGuid();
        var tenantId = Guid.NewGuid();

        _refreshTokenRepo
            .GetByHashAsync(Arg.Any<string>(), Arg.Any<CancellationToken>())
            .Returns(
                new RefreshToken
                {
                    Id = Guid.NewGuid(),
                    UserId = userId,
                    ExpiresAt = DateTime.UtcNow.AddDays(7),
                }
            );

        var user = new User
        {
            Id = userId,
            TenantId = tenantId,
            Email = "user@test.com",
            Name = "User",
            Role = UserRole.Editor, // Old role
        };
        _userRepo.GetByIdCrossTenantsAsync(userId, Arg.Any<CancellationToken>()).Returns(user);

        _membershipRepo
            .GetAsync(userId, tenantId, Arg.Any<CancellationToken>())
            .Returns(
                new TenantMembership
                {
                    UserId = userId,
                    TenantId = tenantId,
                    Role = UserRole.Admin, // Updated role
                }
            );

        var result = await _sut.RefreshTokensAsync("rt_valid", default);

        result.IsError.Should().BeFalse();
        user.Role.Should().Be(UserRole.Admin);
        await _userRepo.Received(1).UpdateAsync(user, Arg.Any<CancellationToken>());
    }

    // ── Accept Invitation ──

    [Fact]
    public async Task AcceptInvitationAsync_ExpiredInvitation_ReturnsNotFound()
    {
        _invitationRepo
            .GetByTokenHashAsync(Arg.Any<string>(), Arg.Any<CancellationToken>())
            .Returns(
                new Invitation
                {
                    ExpiresAt = DateTime.UtcNow.AddDays(-1),
                    Email = "invite@test.com",
                }
            );

        var result = await _sut.AcceptInvitationAsync("inv_token", "User", "Password1!", default);

        result.IsError.Should().BeTrue();
        result.FirstError.Code.Should().Be("INVALID_INVITATION");
    }

    [Fact]
    public async Task AcceptInvitationAsync_MissingInvitation_ReturnsNotFound()
    {
        _invitationRepo
            .GetByTokenHashAsync(Arg.Any<string>(), Arg.Any<CancellationToken>())
            .Returns((Invitation?)null);

        var result = await _sut.AcceptInvitationAsync("inv_token", "User", "Password1!", default);

        result.IsError.Should().BeTrue();
        result.FirstError.Code.Should().Be("INVALID_INVITATION");
    }

    [Fact]
    public async Task AcceptInvitationAsync_EmailAlreadyRegistered_ReturnsConflict()
    {
        _invitationRepo
            .GetByTokenHashAsync(Arg.Any<string>(), Arg.Any<CancellationToken>())
            .Returns(
                new Invitation
                {
                    ExpiresAt = DateTime.UtcNow.AddDays(7),
                    Email = "taken@test.com",
                    TenantId = Guid.NewGuid(),
                    Role = UserRole.Editor,
                }
            );
        _userRepo
            .GetByEmailAsync("taken@test.com", Arg.Any<CancellationToken>())
            .Returns(new User { Email = "taken@test.com" });

        var result = await _sut.AcceptInvitationAsync("inv_token", "User", "Password1!", default);

        result.IsError.Should().BeTrue();
        result.FirstError.Code.Should().Be("EMAIL_ALREADY_EXISTS");
    }

    [Fact]
    public async Task AcceptInvitationAsync_Valid_CreatesUserAndReturnsTokens()
    {
        var tenantId = Guid.NewGuid();
        _invitationRepo
            .GetByTokenHashAsync(Arg.Any<string>(), Arg.Any<CancellationToken>())
            .Returns(
                new Invitation
                {
                    Id = Guid.NewGuid(),
                    ExpiresAt = DateTime.UtcNow.AddDays(7),
                    Email = "invited@test.com",
                    TenantId = tenantId,
                    Role = UserRole.Editor,
                }
            );
        _userRepo
            .GetByEmailAsync("invited@test.com", Arg.Any<CancellationToken>())
            .Returns((User?)null);

        var result = await _sut.AcceptInvitationAsync(
            "inv_token",
            "Invited User",
            "Password1!",
            default
        );

        result.IsError.Should().BeFalse();
        result.Value.User.Email.Should().Be("invited@test.com");
        result.Value.User.Role.Should().Be(UserRole.Editor);
        result.Value.AccessToken.Should().NotBeNullOrEmpty();
        result.Value.RawRefreshToken.Should().StartWith("rt_");

        // Should create 2 memberships: personal + invited workspace
        await _membershipRepo
            .Received(2)
            .CreateAsync(Arg.Any<TenantMembership>(), Arg.Any<CancellationToken>());

        // Should delete the invitation
        await _invitationRepo
            .Received(1)
            .DeleteAsync(tenantId, Arg.Any<Guid>(), Arg.Any<CancellationToken>());
    }
}

/// <summary>
/// Minimal IOptionsMonitor stub for testing.
/// </summary>
internal sealed class OptionsMonitorStub<T>(T value) : IOptionsMonitor<T>
{
    public T CurrentValue => value;

    public T Get(string? name) => value;

    public IDisposable? OnChange(Action<T, string?> listener) => null;
}
