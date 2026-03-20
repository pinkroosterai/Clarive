using Clarive.Auth.Jwt;
using Clarive.Core.Helpers;
using Clarive.Infrastructure.Data;
using Clarive.Domain.Entities;
using Clarive.Domain.Enums;
using Clarive.Domain.Interfaces.Repositories;
using Clarive.Core.Services;
using Clarive.Core.Services.Interfaces;
using Clarive.Domain.Interfaces.Services;
using FluentAssertions;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Diagnostics;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;
using NSubstitute;

namespace Clarive.Api.UnitTests.Services;

public class InvitationServiceTests
{
    private readonly IInvitationRepository _invitationRepo =
        Substitute.For<IInvitationRepository>();
    private readonly IUserRepository _userRepo = Substitute.For<IUserRepository>();
    private readonly ITenantRepository _tenantRepo = Substitute.For<ITenantRepository>();
    private readonly ITenantMembershipRepository _membershipRepo =
        Substitute.For<ITenantMembershipRepository>();
    private readonly IAuditLogger _auditLogger = Substitute.For<IAuditLogger>();
    private readonly IEmailService _emailService = Substitute.For<IEmailService>();
    private readonly JwtService _jwtService;
    private readonly InvitationService _sut;

    private static readonly Guid TenantId = Guid.NewGuid();
    private static readonly Guid UserId = Guid.NewGuid();
    private static readonly Guid InviterId = Guid.NewGuid();

    public InvitationServiceTests()
    {
        var jwtSettings = new JwtSettings
        {
            Secret = "this-is-a-test-secret-key-that-is-at-least-32-bytes-long!",
            Issuer = "test",
            Audience = "test",
            ExpirationMinutes = 15,
            RefreshTokenExpirationDays = 7,
        };
        _jwtService = new JwtService(new OptionsMonitorStub<JwtSettings>(jwtSettings));

        var options = new DbContextOptionsBuilder<ClariveDbContext>()
            .UseInMemoryDatabase(Guid.NewGuid().ToString())
            .ConfigureWarnings(w => w.Ignore(InMemoryEventId.TransactionIgnoredWarning))
            .Options;
        var db = new ClariveDbContext(options);

        var appSettings = Options.Create(
            new AppSettings { FrontendUrl = "https://test.clarive.dev" }
        );
        var logger = Substitute.For<ILogger<InvitationService>>();

        _invitationRepo
            .CreateAsync(Arg.Any<Invitation>(), Arg.Any<CancellationToken>())
            .Returns(ci => ci.Arg<Invitation>());
        _membershipRepo
            .CreateAsync(Arg.Any<TenantMembership>(), Arg.Any<CancellationToken>())
            .Returns(ci => ci.Arg<TenantMembership>());

        _sut = new InvitationService(
            db,
            _invitationRepo,
            _userRepo,
            _tenantRepo,
            _membershipRepo,
            _auditLogger,
            _emailService,
            _jwtService,
            appSettings,
            logger
        );
    }

    // ── CreateAsync — Existing User ──

    [Fact]
    public async Task CreateAsync_ExistingUser_AlreadyMember_ReturnsConflict()
    {
        var existingUser = new User { Id = UserId, Email = "user@test.com" };
        _userRepo
            .GetByEmailAsync("user@test.com", Arg.Any<CancellationToken>())
            .Returns(existingUser);
        _membershipRepo
            .GetAsync(UserId, TenantId, Arg.Any<CancellationToken>())
            .Returns(new TenantMembership { UserId = UserId, TenantId = TenantId });

        var result = await _sut.CreateAsync(
            TenantId,
            InviterId,
            "Admin",
            "user@test.com",
            UserRole.Editor,
            default
        );

        result.IsError.Should().BeTrue();
        result.FirstError.Code.Should().Be("ALREADY_MEMBER");
    }

    [Fact]
    public async Task CreateAsync_ExistingUser_DuplicateInvitation_ReturnsConflict()
    {
        var existingUser = new User { Id = UserId, Email = "user@test.com" };
        _userRepo
            .GetByEmailAsync("user@test.com", Arg.Any<CancellationToken>())
            .Returns(existingUser);
        _membershipRepo
            .GetAsync(UserId, TenantId, Arg.Any<CancellationToken>())
            .Returns((TenantMembership?)null);
        _invitationRepo
            .GetActiveByEmailAsync(TenantId, "user@test.com", Arg.Any<CancellationToken>())
            .Returns(new Invitation { Email = "user@test.com" });

        var result = await _sut.CreateAsync(
            TenantId,
            InviterId,
            "Admin",
            "user@test.com",
            UserRole.Editor,
            default
        );

        result.IsError.Should().BeTrue();
        result.FirstError.Code.Should().Be("INVITATION_EXISTS");
    }

    [Fact]
    public async Task CreateAsync_ExistingUser_Valid_CreatesInvitationWithTargetUserId()
    {
        var existingUser = new User
        {
            Id = UserId,
            Email = "user@test.com",
            Name = "User",
        };
        _userRepo
            .GetByEmailAsync("user@test.com", Arg.Any<CancellationToken>())
            .Returns(existingUser);
        _membershipRepo
            .GetAsync(UserId, TenantId, Arg.Any<CancellationToken>())
            .Returns((TenantMembership?)null);
        _invitationRepo
            .GetActiveByEmailAsync(TenantId, "user@test.com", Arg.Any<CancellationToken>())
            .Returns((Invitation?)null);
        _tenantRepo
            .GetByIdAsync(TenantId, Arg.Any<CancellationToken>())
            .Returns(new Tenant { Id = TenantId, Name = "Test Workspace" });

        var result = await _sut.CreateAsync(
            TenantId,
            InviterId,
            "Admin",
            "user@test.com",
            UserRole.Editor,
            default
        );

        result.IsError.Should().BeFalse();
        result.Value.IsExistingUser.Should().BeTrue();
        result.Value.RawToken.Should().BeNull();
        result.Value.Invitation.TargetUserId.Should().Be(UserId);
        result.Value.Invitation.TokenHash.Should().Be("");
    }

    // ── CreateAsync — New User ──

    [Fact]
    public async Task CreateAsync_NewUser_DuplicateInvitation_ReturnsConflict()
    {
        _userRepo
            .GetByEmailAsync("new@test.com", Arg.Any<CancellationToken>())
            .Returns((User?)null);
        _invitationRepo
            .GetActiveByEmailAsync(TenantId, "new@test.com", Arg.Any<CancellationToken>())
            .Returns(new Invitation { Email = "new@test.com" });

        var result = await _sut.CreateAsync(
            TenantId,
            InviterId,
            "Admin",
            "new@test.com",
            UserRole.Editor,
            default
        );

        result.IsError.Should().BeTrue();
        result.FirstError.Code.Should().Be("INVITATION_EXISTS");
    }

    [Fact]
    public async Task CreateAsync_NewUser_Valid_CreatesInvitationWithToken()
    {
        _userRepo
            .GetByEmailAsync("new@test.com", Arg.Any<CancellationToken>())
            .Returns((User?)null);
        _invitationRepo
            .GetActiveByEmailAsync(TenantId, "new@test.com", Arg.Any<CancellationToken>())
            .Returns((Invitation?)null);
        _tenantRepo
            .GetByIdAsync(TenantId, Arg.Any<CancellationToken>())
            .Returns(new Tenant { Id = TenantId, Name = "Test Workspace" });

        var result = await _sut.CreateAsync(
            TenantId,
            InviterId,
            "Admin",
            "new@test.com",
            UserRole.Editor,
            default
        );

        result.IsError.Should().BeFalse();
        result.Value.IsExistingUser.Should().BeFalse();
        result.Value.RawToken.Should().NotBeNullOrEmpty();
        result.Value.Invitation.TargetUserId.Should().BeNull();
        result.Value.Invitation.TokenHash.Should().NotBeEmpty();
    }

    [Fact]
    public async Task CreateAsync_NormalizesEmail()
    {
        _userRepo
            .GetByEmailAsync("new@test.com", Arg.Any<CancellationToken>())
            .Returns((User?)null);
        _invitationRepo
            .GetActiveByEmailAsync(TenantId, "new@test.com", Arg.Any<CancellationToken>())
            .Returns((Invitation?)null);
        _tenantRepo
            .GetByIdAsync(TenantId, Arg.Any<CancellationToken>())
            .Returns(new Tenant { Id = TenantId, Name = "WS" });

        var result = await _sut.CreateAsync(
            TenantId,
            InviterId,
            "Admin",
            "  NEW@Test.COM  ",
            UserRole.Editor,
            default
        );

        result.IsError.Should().BeFalse();
        result.Value.Invitation.Email.Should().Be("new@test.com");
    }

    // ── ValidateAsync ──

    [Fact]
    public async Task ValidateAsync_InvalidToken_ReturnsNull()
    {
        _invitationRepo
            .GetByTokenHashAsync(Arg.Any<string>(), Arg.Any<CancellationToken>())
            .Returns((Invitation?)null);

        var result = await _sut.ValidateAsync("invalid-token", default);

        result.Should().BeNull();
    }

    [Fact]
    public async Task ValidateAsync_ExpiredToken_ReturnsNull()
    {
        _invitationRepo
            .GetByTokenHashAsync(Arg.Any<string>(), Arg.Any<CancellationToken>())
            .Returns(
                new Invitation
                {
                    Email = "user@test.com",
                    Role = UserRole.Editor,
                    TenantId = TenantId,
                    ExpiresAt = DateTime.UtcNow.AddDays(-1),
                }
            );

        var result = await _sut.ValidateAsync("expired-token", default);

        result.Should().BeNull();
    }

    [Fact]
    public async Task ValidateAsync_Valid_ReturnsInvitationInfo()
    {
        _invitationRepo
            .GetByTokenHashAsync(Arg.Any<string>(), Arg.Any<CancellationToken>())
            .Returns(
                new Invitation
                {
                    Email = "user@test.com",
                    Role = UserRole.Editor,
                    TenantId = TenantId,
                    ExpiresAt = DateTime.UtcNow.AddDays(7),
                }
            );
        _tenantRepo
            .GetByIdAsync(TenantId, Arg.Any<CancellationToken>())
            .Returns(new Tenant { Id = TenantId, Name = "My Workspace" });

        var result = await _sut.ValidateAsync("valid-token", default);

        result.Should().NotBeNull();
        result!.Email.Should().Be("user@test.com");
        result.Role.Should().Be("editor");
        result.WorkspaceName.Should().Be("My Workspace");
    }

    // ── RevokeAsync ──

    [Fact]
    public async Task RevokeAsync_NotFound_ReturnsNull()
    {
        _invitationRepo
            .GetByIdAsync(TenantId, Arg.Any<Guid>(), Arg.Any<CancellationToken>())
            .Returns((Invitation?)null);

        var result = await _sut.RevokeAsync(TenantId, Guid.NewGuid(), default);

        result.Should().BeNull();
    }

    [Fact]
    public async Task RevokeAsync_Valid_DeletesAndReturnsInvitation()
    {
        var invitationId = Guid.NewGuid();
        var invitation = new Invitation { Id = invitationId, Email = "user@test.com" };
        _invitationRepo
            .GetByIdAsync(TenantId, invitationId, Arg.Any<CancellationToken>())
            .Returns(invitation);

        var result = await _sut.RevokeAsync(TenantId, invitationId, default);

        result.Should().BeSameAs(invitation);
        await _invitationRepo
            .Received(1)
            .DeleteAsync(TenantId, invitationId, Arg.Any<CancellationToken>());
    }

    // ── RespondAsync ──

    [Fact]
    public async Task RespondAsync_NotFound_ReturnsNotFound()
    {
        _invitationRepo
            .GetByIdCrossTenantsAsync(Arg.Any<Guid>(), Arg.Any<CancellationToken>())
            .Returns((Invitation?)null);

        var result = await _sut.RespondAsync(UserId, Guid.NewGuid(), true, default);

        result.IsError.Should().BeTrue();
        result.FirstError.Code.Should().Be("NOT_FOUND");
    }

    [Fact]
    public async Task RespondAsync_ExpiredInvitation_ReturnsNotFound()
    {
        _invitationRepo
            .GetByIdCrossTenantsAsync(Arg.Any<Guid>(), Arg.Any<CancellationToken>())
            .Returns(
                new Invitation
                {
                    TargetUserId = UserId,
                    ExpiresAt = DateTime.UtcNow.AddDays(-1),
                    TenantId = TenantId,
                }
            );

        var result = await _sut.RespondAsync(UserId, Guid.NewGuid(), true, default);

        result.IsError.Should().BeTrue();
        result.FirstError.Code.Should().Be("NOT_FOUND");
    }

    [Fact]
    public async Task RespondAsync_WrongUser_ReturnsNotFound()
    {
        _invitationRepo
            .GetByIdCrossTenantsAsync(Arg.Any<Guid>(), Arg.Any<CancellationToken>())
            .Returns(
                new Invitation
                {
                    TargetUserId = Guid.NewGuid(), // different user
                    ExpiresAt = DateTime.UtcNow.AddDays(7),
                    TenantId = TenantId,
                }
            );

        var result = await _sut.RespondAsync(UserId, Guid.NewGuid(), true, default);

        result.IsError.Should().BeTrue();
        result.FirstError.Code.Should().Be("NOT_FOUND");
    }

    [Fact]
    public async Task RespondAsync_Decline_DeletesInvitation()
    {
        var invitationId = Guid.NewGuid();
        _invitationRepo
            .GetByIdCrossTenantsAsync(invitationId, Arg.Any<CancellationToken>())
            .Returns(
                new Invitation
                {
                    Id = invitationId,
                    TargetUserId = UserId,
                    ExpiresAt = DateTime.UtcNow.AddDays(7),
                    TenantId = TenantId,
                }
            );

        var result = await _sut.RespondAsync(UserId, invitationId, false, default);

        result.IsError.Should().BeFalse();
        result.Value.Accepted.Should().BeFalse();
        await _invitationRepo
            .Received(1)
            .DeleteCrossTenantsAsync(invitationId, Arg.Any<CancellationToken>());
    }

    [Fact]
    public async Task RespondAsync_Accept_AlreadyMember_ReturnsConflict()
    {
        var invitationId = Guid.NewGuid();
        _invitationRepo
            .GetByIdCrossTenantsAsync(invitationId, Arg.Any<CancellationToken>())
            .Returns(
                new Invitation
                {
                    Id = invitationId,
                    TargetUserId = UserId,
                    ExpiresAt = DateTime.UtcNow.AddDays(7),
                    TenantId = TenantId,
                    Role = UserRole.Editor,
                }
            );
        _membershipRepo
            .GetAsync(UserId, TenantId, Arg.Any<CancellationToken>())
            .Returns(new TenantMembership { UserId = UserId, TenantId = TenantId });

        var result = await _sut.RespondAsync(UserId, invitationId, true, default);

        result.IsError.Should().BeTrue();
        result.FirstError.Code.Should().Be("ALREADY_MEMBER");
    }

    [Fact]
    public async Task RespondAsync_Accept_Valid_CreatesMembershipAndDeletesInvitation()
    {
        var invitationId = Guid.NewGuid();
        _invitationRepo
            .GetByIdCrossTenantsAsync(invitationId, Arg.Any<CancellationToken>())
            .Returns(
                new Invitation
                {
                    Id = invitationId,
                    TargetUserId = UserId,
                    ExpiresAt = DateTime.UtcNow.AddDays(7),
                    TenantId = TenantId,
                    Role = UserRole.Editor,
                }
            );
        _membershipRepo
            .GetAsync(UserId, TenantId, Arg.Any<CancellationToken>())
            .Returns((TenantMembership?)null);
        _tenantRepo
            .GetByIdAsync(TenantId, Arg.Any<CancellationToken>())
            .Returns(new Tenant { Id = TenantId, Name = "WS" });
        _membershipRepo
            .GetByTenantIdAsync(TenantId, Arg.Any<CancellationToken>())
            .Returns(new List<TenantMembership> { new(), new() });

        var result = await _sut.RespondAsync(UserId, invitationId, true, default);

        result.IsError.Should().BeFalse();
        result.Value.Accepted.Should().BeTrue();
        result.Value.WorkspaceName.Should().Be("WS");
        result.Value.MemberCount.Should().Be(2);
        await _membershipRepo
            .Received(1)
            .CreateAsync(
                Arg.Is<TenantMembership>(m =>
                    m.UserId == UserId && m.TenantId == TenantId && m.Role == UserRole.Editor
                ),
                Arg.Any<CancellationToken>()
            );
        await _invitationRepo
            .Received(1)
            .DeleteCrossTenantsAsync(invitationId, Arg.Any<CancellationToken>());
    }

    // ── GetPendingCountAsync ──

    [Fact]
    public async Task GetPendingCountAsync_FiltersExpired()
    {
        _invitationRepo
            .GetPendingByUserIdAsync(UserId, Arg.Any<CancellationToken>())
            .Returns(
                new List<Invitation>
                {
                    new() { ExpiresAt = DateTime.UtcNow.AddDays(7) },
                    new() { ExpiresAt = DateTime.UtcNow.AddDays(-1) }, // expired
                    new() { ExpiresAt = DateTime.UtcNow.AddDays(3) },
                }
            );

        var count = await _sut.GetPendingCountAsync(UserId, default);

        count.Should().Be(2);
    }
}
