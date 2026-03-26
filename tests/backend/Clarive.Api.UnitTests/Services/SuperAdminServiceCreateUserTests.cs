using Clarive.Auth.Jwt;
using Clarive.Infrastructure.Security;
using Clarive.Domain.Entities;
using Clarive.Domain.Enums;
using Clarive.Domain.Interfaces.Repositories;
using Clarive.Domain.Interfaces.Services;
using Clarive.Application.Users.Contracts;
using FluentAssertions;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;
using NSubstitute;

namespace Clarive.Api.UnitTests.Services;

public class SuperAdminServiceCreateUserTests
{
    private readonly IUserRepository _userRepo = Substitute.For<IUserRepository>();
    private readonly IUserWorkspaceCreationService _workspaceCreation =
        Substitute.For<IUserWorkspaceCreationService>();
    private readonly IUnitOfWork _unitOfWork = Substitute.For<IUnitOfWork>();
    private readonly ITenantMembershipRepository _membershipRepo =
        Substitute.For<ITenantMembershipRepository>();
    private readonly ITenantRepository _tenantRepo = Substitute.For<ITenantRepository>();
    private readonly ITokenRepository _tokenRepo = Substitute.For<ITokenRepository>();
    private readonly IEmailService _emailService = Substitute.For<IEmailService>();

    private static readonly Guid WorkspaceId = Guid.NewGuid();
    private static readonly Guid UserId = Guid.NewGuid();

    private SuperAdminService CreateService(string emailProvider = "none")
    {
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
            .AddInMemoryCollection(
                new Dictionary<string, string?> { ["Email:Provider"] = emailProvider }
            )
            .Build();

        var appSettings = Options.Create(new AppSettings { FrontendUrl = "http://localhost:8080" });

        // Make UnitOfWork execute the function directly
        _unitOfWork
            .ExecuteInTransactionAsync(Arg.Any<Func<Task<ErrorOr.ErrorOr<CreateUserResponse>>>>(), Arg.Any<CancellationToken>())
            .Returns(ci => ci.Arg<Func<Task<ErrorOr.ErrorOr<CreateUserResponse>>>>()());

        // Default workspace exists
        _tenantRepo
            .GetByIdAsync(WorkspaceId, Arg.Any<CancellationToken>())
            .Returns(new Tenant { Id = WorkspaceId, Name = "Test Workspace" });

        // Default: no duplicate email
        _userRepo
            .GetByEmailAsync(Arg.Any<string>(), Arg.Any<CancellationToken>())
            .Returns((User?)null);

        // Workspace creation returns a user + tenant
        _workspaceCreation
            .CreateUserWithPersonalWorkspaceAsync(
                Arg.Any<string>(),
                Arg.Any<string>(),
                Arg.Any<string?>(),
                Arg.Any<string?>(),
                Arg.Any<bool>(),
                Arg.Any<bool>(),
                Arg.Any<string?>(),
                Arg.Any<CancellationToken>()
            )
            .Returns(ci =>
            {
                var user = new User
                {
                    Id = UserId,
                    Email = ci.ArgAt<string>(0),
                    Name = ci.ArgAt<string>(1),
                    EmailVerified = true,
                };
                var tenant = new Tenant { Id = Guid.NewGuid(), Name = $"{user.Name}'s workspace" };
                return (user, tenant);
            });

        _membershipRepo
            .CreateAsync(Arg.Any<TenantMembership>(), Arg.Any<CancellationToken>())
            .Returns(ci => ci.Arg<TenantMembership>());

        return new SuperAdminService(
            Substitute.For<IPlatformStatsRepository>(),
            Substitute.For<ISuperAdminRepository>(),
            _userRepo,
            new PasswordHasher(),
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

    [Fact]
    public async Task CreateUserAsync_NoEmail_ReturnsGeneratedPassword()
    {
        var sut = CreateService(emailProvider: "none");
        var request = new CreateUserRequest("Test User", "new@test.com", WorkspaceId, "Editor");

        var result = await sut.CreateUserAsync(request, default);

        result.IsError.Should().BeFalse();
        result.Value.Email.Should().Be("new@test.com");
        result.Value.GeneratedPassword.Should().NotBeNullOrEmpty();
        result.Value.GeneratedPassword!.Length.Should().Be(16);
    }

    [Fact]
    public async Task CreateUserAsync_WithEmail_SendsSetupEmailAndNoPassword()
    {
        var sut = CreateService(emailProvider: "resend");
        var request = new CreateUserRequest("Test User", "new@test.com", WorkspaceId, "Editor");

        var result = await sut.CreateUserAsync(request, default);

        result.IsError.Should().BeFalse();
        result.Value.GeneratedPassword.Should().BeNull();
        await _emailService.Received(1).SendPasswordResetEmailAsync(
            "new@test.com",
            "Test User",
            Arg.Is<string>(s => s.Contains("/reset-password?token=")),
            Arg.Any<CancellationToken>()
        );
    }

    [Fact]
    public async Task CreateUserAsync_DuplicateEmail_ReturnsConflict()
    {
        var sut = CreateService();
        _userRepo
            .GetByEmailAsync("existing@test.com", Arg.Any<CancellationToken>())
            .Returns(new User { Id = Guid.NewGuid(), Email = "existing@test.com" });

        var request = new CreateUserRequest("Test", "existing@test.com", WorkspaceId, "Editor");

        var result = await sut.CreateUserAsync(request, default);

        result.IsError.Should().BeTrue();
        result.FirstError.Code.Should().Be("EMAIL_ALREADY_EXISTS");
    }

    [Fact]
    public async Task CreateUserAsync_InvalidWorkspace_ReturnsNotFound()
    {
        var sut = CreateService();
        _tenantRepo
            .GetByIdAsync(Arg.Any<Guid>(), Arg.Any<CancellationToken>())
            .Returns((Tenant?)null);

        var request = new CreateUserRequest("Test", "new@test.com", Guid.NewGuid(), "Editor");

        var result = await sut.CreateUserAsync(request, default);

        result.IsError.Should().BeTrue();
        result.FirstError.Code.Should().Be("WORKSPACE_NOT_FOUND");
    }

    [Fact]
    public async Task CreateUserAsync_CreatesWorkspaceMembership()
    {
        var sut = CreateService();
        var request = new CreateUserRequest("Test User", "new@test.com", WorkspaceId, "Admin");

        await sut.CreateUserAsync(request, default);

        await _membershipRepo.Received(1).CreateAsync(
            Arg.Is<TenantMembership>(m =>
                m.TenantId == WorkspaceId &&
                m.Role == UserRole.Admin &&
                !m.IsPersonal
            ),
            Arg.Any<CancellationToken>()
        );
    }
}
