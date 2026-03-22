using Clarive.Auth.Jwt;
using Clarive.Infrastructure.Security;
using Clarive.Domain.Entities;
using Clarive.Domain.Interfaces.Repositories;
using Clarive.Domain.Interfaces.Services;
using FluentAssertions;
using Microsoft.Extensions.Options;
using Microsoft.Extensions.Logging;
using NSubstitute;

namespace Clarive.Api.UnitTests.Services;

public class AuthServiceTests
{
    private readonly IUserRepository _userRepo = Substitute.For<IUserRepository>();
    private readonly ITokenRepository _tokenRepo = Substitute.For<ITokenRepository>();
    private readonly IRefreshTokenRepository _refreshTokenRepo =
        Substitute.For<IRefreshTokenRepository>();
    private readonly IEmailService _emailService = Substitute.For<IEmailService>();
    private readonly JwtService _jwtService;
    private readonly PasswordHasher _passwordHasher = new();
    private readonly AuthService _sut;

    private static readonly Guid UserId = Guid.NewGuid();
    private static readonly Guid TenantId = Guid.NewGuid();

    public AuthServiceTests()
    {
        var jwtSettings = new JwtSettings
        {
            Secret = "this-is-a-test-secret-key-that-is-at-least-32-bytes-long!",
            Issuer = "test",
            Audience = "test",
            ExpirationMinutes = 15,
            RefreshTokenExpirationDays = 7,
        };
        _jwtService = new JwtService(new OptionsMonitorStub<JwtSettings>(jwtSettings), Substitute.For<ILogger<JwtService>>());

        var appSettings = Options.Create(
            new AppSettings { FrontendUrl = "https://test.clarive.dev" }
        );

        _sut = new AuthService(
            _userRepo,
            _tokenRepo,
            _refreshTokenRepo,
            _emailService,
            appSettings,
            _jwtService,
            _passwordHasher,
            Substitute.For<ILogger<AuthService>>()
        );
    }

    // ── VerifyEmailAsync ──

    [Fact]
    public async Task VerifyEmailAsync_NullToken_ReturnsValidationError()
    {
        _tokenRepo
            .GetVerificationByHashAsync(Arg.Any<string>(), Arg.Any<CancellationToken>())
            .Returns((EmailVerificationToken?)null);

        var result = await _sut.VerifyEmailAsync("invalid-token", default);

        result.IsError.Should().BeTrue();
        result.FirstError.Code.Should().Be("INVALID_TOKEN");
    }

    [Fact]
    public async Task VerifyEmailAsync_UsedToken_ReturnsValidationError()
    {
        _tokenRepo
            .GetVerificationByHashAsync(Arg.Any<string>(), Arg.Any<CancellationToken>())
            .Returns(
                new EmailVerificationToken
                {
                    Id = Guid.NewGuid(),
                    UserId = UserId,
                    UsedAt = DateTime.UtcNow.AddMinutes(-5),
                    ExpiresAt = DateTime.UtcNow.AddHours(24),
                }
            );

        var result = await _sut.VerifyEmailAsync("used-token", default);

        result.IsError.Should().BeTrue();
        result.FirstError.Code.Should().Be("INVALID_TOKEN");
    }

    [Fact]
    public async Task VerifyEmailAsync_ExpiredToken_ReturnsValidationError()
    {
        _tokenRepo
            .GetVerificationByHashAsync(Arg.Any<string>(), Arg.Any<CancellationToken>())
            .Returns(
                new EmailVerificationToken
                {
                    Id = Guid.NewGuid(),
                    UserId = UserId,
                    ExpiresAt = DateTime.UtcNow.AddHours(-1),
                }
            );

        var result = await _sut.VerifyEmailAsync("expired-token", default);

        result.IsError.Should().BeTrue();
        result.FirstError.Code.Should().Be("INVALID_TOKEN");
    }

    [Fact]
    public async Task VerifyEmailAsync_UserNotFound_ReturnsValidationError()
    {
        _tokenRepo
            .GetVerificationByHashAsync(Arg.Any<string>(), Arg.Any<CancellationToken>())
            .Returns(
                new EmailVerificationToken
                {
                    Id = Guid.NewGuid(),
                    UserId = UserId,
                    ExpiresAt = DateTime.UtcNow.AddHours(24),
                }
            );
        _userRepo
            .GetByIdCrossTenantsAsync(UserId, Arg.Any<CancellationToken>())
            .Returns((User?)null);

        var result = await _sut.VerifyEmailAsync("valid-token", default);

        result.IsError.Should().BeTrue();
        result.FirstError.Code.Should().Be("INVALID_TOKEN");
    }

    [Fact]
    public async Task VerifyEmailAsync_AlreadyVerified_MarksTokenUsedAndReturnsMessage()
    {
        var tokenId = Guid.NewGuid();
        _tokenRepo
            .GetVerificationByHashAsync(Arg.Any<string>(), Arg.Any<CancellationToken>())
            .Returns(
                new EmailVerificationToken
                {
                    Id = tokenId,
                    UserId = UserId,
                    ExpiresAt = DateTime.UtcNow.AddHours(24),
                }
            );
        _userRepo
            .GetByIdCrossTenantsAsync(UserId, Arg.Any<CancellationToken>())
            .Returns(new User { Id = UserId, EmailVerified = true });

        var result = await _sut.VerifyEmailAsync("valid-token", default);

        result.IsError.Should().BeFalse();
        result.Value.Should().Contain("already verified");
        await _tokenRepo
            .Received(1)
            .MarkVerificationUsedAsync(tokenId, Arg.Any<CancellationToken>());
        await _userRepo.DidNotReceive().UpdateAsync(Arg.Any<User>(), Arg.Any<CancellationToken>());
    }

    [Fact]
    public async Task VerifyEmailAsync_ValidToken_VerifiesEmailAndMarksTokenUsed()
    {
        var tokenId = Guid.NewGuid();
        var user = new User { Id = UserId, EmailVerified = false };

        _tokenRepo
            .GetVerificationByHashAsync(Arg.Any<string>(), Arg.Any<CancellationToken>())
            .Returns(
                new EmailVerificationToken
                {
                    Id = tokenId,
                    UserId = UserId,
                    ExpiresAt = DateTime.UtcNow.AddHours(24),
                }
            );
        _userRepo.GetByIdCrossTenantsAsync(UserId, Arg.Any<CancellationToken>()).Returns(user);

        var result = await _sut.VerifyEmailAsync("valid-token", default);

        result.IsError.Should().BeFalse();
        result.Value.Should().Contain("successfully");
        user.EmailVerified.Should().BeTrue();
        await _userRepo.Received(1).UpdateAsync(user, Arg.Any<CancellationToken>());
        await _tokenRepo
            .Received(1)
            .MarkVerificationUsedAsync(tokenId, Arg.Any<CancellationToken>());
    }

    // ── ResendVerificationAsync ──

    [Fact]
    public async Task ResendVerificationAsync_UserNotFound_ReturnsNotFound()
    {
        _userRepo.GetByIdAsync(TenantId, UserId, Arg.Any<CancellationToken>()).Returns((User?)null);

        var result = await _sut.ResendVerificationAsync(TenantId, UserId, default);

        result.IsError.Should().BeTrue();
        result.FirstError.Code.Should().Be("USER_NOT_FOUND");
    }

    [Fact]
    public async Task ResendVerificationAsync_AlreadyVerified_ReturnsConflict()
    {
        _userRepo
            .GetByIdAsync(TenantId, UserId, Arg.Any<CancellationToken>())
            .Returns(new User { Id = UserId, EmailVerified = true });

        var result = await _sut.ResendVerificationAsync(TenantId, UserId, default);

        result.IsError.Should().BeTrue();
        result.FirstError.Code.Should().Be("ALREADY_VERIFIED");
    }

    [Fact]
    public async Task ResendVerificationAsync_RateLimited_Returns429()
    {
        _userRepo
            .GetByIdAsync(TenantId, UserId, Arg.Any<CancellationToken>())
            .Returns(new User { Id = UserId, EmailVerified = false });
        _tokenRepo
            .CountRecentVerificationTokensAsync(
                UserId,
                Arg.Any<TimeSpan>(),
                Arg.Any<CancellationToken>()
            )
            .Returns(1);

        var result = await _sut.ResendVerificationAsync(TenantId, UserId, default);

        result.IsError.Should().BeTrue();
        result.FirstError.Code.Should().Be("RATE_LIMIT");
        result.FirstError.NumericType.Should().Be(429);
    }

    [Fact]
    public async Task ResendVerificationAsync_Valid_CreatesTokenAndSendsEmail()
    {
        var user = new User
        {
            Id = UserId,
            Email = "test@test.com",
            Name = "Test",
            EmailVerified = false,
        };
        _userRepo.GetByIdAsync(TenantId, UserId, Arg.Any<CancellationToken>()).Returns(user);
        _tokenRepo
            .CountRecentVerificationTokensAsync(
                UserId,
                Arg.Any<TimeSpan>(),
                Arg.Any<CancellationToken>()
            )
            .Returns(0);

        var result = await _sut.ResendVerificationAsync(TenantId, UserId, default);

        result.IsError.Should().BeFalse();
        result.Value.Should().Contain("Verification email sent");
        await _tokenRepo
            .Received(1)
            .CreateVerificationTokenAsync(
                Arg.Any<EmailVerificationToken>(),
                Arg.Any<CancellationToken>()
            );
        await _emailService
            .Received(1)
            .SendVerificationEmailAsync(
                "test@test.com",
                "Test",
                Arg.Is<string>(u => u.Contains("/verify-email?token=")),
                Arg.Any<CancellationToken>()
            );
    }

    // ── ForgotPasswordAsync ──

    [Fact]
    public async Task ForgotPasswordAsync_NullEmail_DoesNothing()
    {
        await _sut.ForgotPasswordAsync(null, default);

        await _userRepo
            .DidNotReceive()
            .GetByEmailAsync(Arg.Any<string>(), Arg.Any<CancellationToken>());
    }

    [Fact]
    public async Task ForgotPasswordAsync_EmptyEmail_DoesNothing()
    {
        await _sut.ForgotPasswordAsync("  ", default);

        await _userRepo
            .DidNotReceive()
            .GetByEmailAsync(Arg.Any<string>(), Arg.Any<CancellationToken>());
    }

    [Fact]
    public async Task ForgotPasswordAsync_UnknownEmail_DoesNotSendEmail()
    {
        _userRepo
            .GetByEmailAsync("unknown@test.com", Arg.Any<CancellationToken>())
            .Returns((User?)null);

        await _sut.ForgotPasswordAsync("unknown@test.com", default);

        await _emailService
            .DidNotReceive()
            .SendPasswordResetEmailAsync(
                Arg.Any<string>(),
                Arg.Any<string>(),
                Arg.Any<string>(),
                Arg.Any<CancellationToken>()
            );
    }

    [Fact]
    public async Task ForgotPasswordAsync_RateLimited_DoesNotSendEmail()
    {
        var user = new User
        {
            Id = UserId,
            Email = "test@test.com",
            Name = "Test",
        };
        _userRepo.GetByEmailAsync("test@test.com", Arg.Any<CancellationToken>()).Returns(user);
        _tokenRepo
            .CountRecentResetTokensAsync(UserId, Arg.Any<TimeSpan>(), Arg.Any<CancellationToken>())
            .Returns(3);

        await _sut.ForgotPasswordAsync("test@test.com", default);

        await _tokenRepo
            .DidNotReceive()
            .CreateResetTokenAsync(Arg.Any<PasswordResetToken>(), Arg.Any<CancellationToken>());
        await _emailService
            .DidNotReceive()
            .SendPasswordResetEmailAsync(
                Arg.Any<string>(),
                Arg.Any<string>(),
                Arg.Any<string>(),
                Arg.Any<CancellationToken>()
            );
    }

    [Fact]
    public async Task ForgotPasswordAsync_Valid_CreatesTokenAndSendsEmail()
    {
        var user = new User
        {
            Id = UserId,
            Email = "test@test.com",
            Name = "Test",
        };
        _userRepo.GetByEmailAsync("test@test.com", Arg.Any<CancellationToken>()).Returns(user);
        _tokenRepo
            .CountRecentResetTokensAsync(UserId, Arg.Any<TimeSpan>(), Arg.Any<CancellationToken>())
            .Returns(0);

        await _sut.ForgotPasswordAsync("test@test.com", default);

        await _tokenRepo
            .Received(1)
            .CreateResetTokenAsync(Arg.Any<PasswordResetToken>(), Arg.Any<CancellationToken>());
        await _emailService
            .Received(1)
            .SendPasswordResetEmailAsync(
                "test@test.com",
                "Test",
                Arg.Is<string>(u => u.Contains("/reset-password?token=")),
                Arg.Any<CancellationToken>()
            );
    }

    // ── ResetPasswordAsync ──

    [Fact]
    public async Task ResetPasswordAsync_EmptyPassword_ReturnsValidationError()
    {
        var result = await _sut.ResetPasswordAsync("token", "  ", default);

        result.IsError.Should().BeTrue();
        result.FirstError.Code.Should().Be("VALIDATION_ERROR");
    }

    [Fact]
    public async Task ResetPasswordAsync_TooShortPassword_ReturnsValidationError()
    {
        var result = await _sut.ResetPasswordAsync("token", "short", default);

        result.IsError.Should().BeTrue();
        result.FirstError.Code.Should().Be("VALIDATION_ERROR");
        result.FirstError.Description.Should().Contain($"{Validator.MinPasswordLength}");
    }

    [Fact]
    public async Task ResetPasswordAsync_InvalidToken_ReturnsValidationError()
    {
        _tokenRepo
            .GetResetByHashAsync(Arg.Any<string>(), Arg.Any<CancellationToken>())
            .Returns((PasswordResetToken?)null);

        var result = await _sut.ResetPasswordAsync("invalid", "ValidPassword123!", default);

        result.IsError.Should().BeTrue();
        result.FirstError.Code.Should().Be("INVALID_TOKEN");
    }

    [Fact]
    public async Task ResetPasswordAsync_UsedToken_ReturnsValidationError()
    {
        _tokenRepo
            .GetResetByHashAsync(Arg.Any<string>(), Arg.Any<CancellationToken>())
            .Returns(
                new PasswordResetToken
                {
                    Id = Guid.NewGuid(),
                    UserId = UserId,
                    UsedAt = DateTime.UtcNow.AddMinutes(-5),
                    ExpiresAt = DateTime.UtcNow.AddHours(1),
                }
            );

        var result = await _sut.ResetPasswordAsync("used", "ValidPassword123!", default);

        result.IsError.Should().BeTrue();
        result.FirstError.Code.Should().Be("INVALID_TOKEN");
    }

    [Fact]
    public async Task ResetPasswordAsync_ExpiredToken_ReturnsValidationError()
    {
        _tokenRepo
            .GetResetByHashAsync(Arg.Any<string>(), Arg.Any<CancellationToken>())
            .Returns(
                new PasswordResetToken
                {
                    Id = Guid.NewGuid(),
                    UserId = UserId,
                    ExpiresAt = DateTime.UtcNow.AddHours(-1),
                }
            );

        var result = await _sut.ResetPasswordAsync("expired", "ValidPassword123!", default);

        result.IsError.Should().BeTrue();
        result.FirstError.Code.Should().Be("INVALID_TOKEN");
    }

    [Fact]
    public async Task ResetPasswordAsync_UserNotFound_ReturnsValidationError()
    {
        _tokenRepo
            .GetResetByHashAsync(Arg.Any<string>(), Arg.Any<CancellationToken>())
            .Returns(
                new PasswordResetToken
                {
                    Id = Guid.NewGuid(),
                    UserId = UserId,
                    ExpiresAt = DateTime.UtcNow.AddHours(1),
                }
            );
        _userRepo
            .GetByIdCrossTenantsAsync(UserId, Arg.Any<CancellationToken>())
            .Returns((User?)null);

        var result = await _sut.ResetPasswordAsync("valid", "ValidPassword123!", default);

        result.IsError.Should().BeTrue();
        result.FirstError.Code.Should().Be("INVALID_TOKEN");
    }

    [Fact]
    public async Task ResetPasswordAsync_Valid_ResetsPasswordAndRevokesTokens()
    {
        var tokenId = Guid.NewGuid();
        var user = new User { Id = UserId, PasswordHash = _passwordHasher.Hash("OldPassword123!") };

        _tokenRepo
            .GetResetByHashAsync(Arg.Any<string>(), Arg.Any<CancellationToken>())
            .Returns(
                new PasswordResetToken
                {
                    Id = tokenId,
                    UserId = UserId,
                    ExpiresAt = DateTime.UtcNow.AddHours(1),
                }
            );
        _userRepo.GetByIdCrossTenantsAsync(UserId, Arg.Any<CancellationToken>()).Returns(user);

        var result = await _sut.ResetPasswordAsync("valid", "NewPassword123!", default);

        result.IsError.Should().BeFalse();
        result.Value.Should().Contain("successfully");

        // Password was updated
        _passwordHasher.Verify("NewPassword123!", user.PasswordHash).Should().BeTrue();

        // Token marked as used
        await _tokenRepo.Received(1).MarkResetUsedAsync(tokenId, Arg.Any<CancellationToken>());

        // All refresh tokens revoked for security
        await _refreshTokenRepo
            .Received(1)
            .RevokeAllForUserAsync(UserId, Arg.Any<CancellationToken>());
    }
}
