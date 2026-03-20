using Clarive.Infrastructure.Security;
using Clarive.Api.Auth;
using Clarive.Domain.Entities;
using Clarive.Api.Models.Requests;
using Clarive.Domain.ValueObjects;
using Clarive.Domain.Interfaces.Repositories;
using Clarive.Api.Services;
using FluentAssertions;
using NSubstitute;

namespace Clarive.Api.UnitTests.Services;

public class ProfileServiceTests
{
    private readonly IUserRepository _userRepo = Substitute.For<IUserRepository>();
    private readonly PasswordHasher _passwordHasher = new();
    private readonly ProfileService _sut;

    private static readonly Guid TenantId = Guid.NewGuid();
    private static readonly Guid UserId = Guid.NewGuid();

    public ProfileServiceTests()
    {
        _userRepo
            .UpdateAsync(Arg.Any<User>(), Arg.Any<CancellationToken>())
            .Returns(ci => ci.Arg<User>());

        _sut = new ProfileService(_userRepo, _passwordHasher);
    }

    private User MakeUser(bool withPassword = true) =>
        new()
        {
            Id = UserId,
            TenantId = TenantId,
            Email = "user@test.com",
            Name = "Test User",
            PasswordHash = withPassword ? _passwordHasher.Hash("CurrentPassword1!") : null,
            ThemePreference = "system",
            OnboardingCompleted = false,
        };

    // ── UpdateProfileAsync — Name ──

    [Fact]
    public async Task UpdateProfileAsync_UserNotFound_ReturnsNotFound()
    {
        _userRepo.GetByIdAsync(TenantId, UserId, Arg.Any<CancellationToken>()).Returns((User?)null);

        var result = await _sut.UpdateProfileAsync(
            TenantId,
            UserId,
            new UpdateProfileRequest(Name: "New"),
            default
        );

        result.IsError.Should().BeTrue();
        result.FirstError.Code.Should().Be("NOT_FOUND");
    }

    [Fact]
    public async Task UpdateProfileAsync_UpdateName_UpdatesSuccessfully()
    {
        var user = MakeUser();
        _userRepo.GetByIdAsync(TenantId, UserId, Arg.Any<CancellationToken>()).Returns(user);

        var result = await _sut.UpdateProfileAsync(
            TenantId,
            UserId,
            new UpdateProfileRequest(Name: "New Name"),
            default
        );

        result.IsError.Should().BeFalse();
        result.Value.Name.Should().Be("New Name");
        await _userRepo.Received(1).UpdateAsync(user, Arg.Any<CancellationToken>());
    }

    [Fact]
    public async Task UpdateProfileAsync_NameTooLong_ReturnsValidationError()
    {
        var user = MakeUser();
        _userRepo.GetByIdAsync(TenantId, UserId, Arg.Any<CancellationToken>()).Returns(user);

        var result = await _sut.UpdateProfileAsync(
            TenantId,
            UserId,
            new UpdateProfileRequest(Name: new string('A', 256)),
            default
        );

        result.IsError.Should().BeTrue();
        result.FirstError.Code.Should().Be("VALIDATION_ERROR");
        result.FirstError.Description.Should().Contain("255");
    }

    // ── UpdateProfileAsync — Email ──

    [Fact]
    public async Task UpdateProfileAsync_ChangeEmail_RequiresCurrentPassword()
    {
        var user = MakeUser();
        _userRepo.GetByIdAsync(TenantId, UserId, Arg.Any<CancellationToken>()).Returns(user);

        var result = await _sut.UpdateProfileAsync(
            TenantId,
            UserId,
            new UpdateProfileRequest(Email: "new@test.com"),
            default
        );

        result.IsError.Should().BeTrue();
        result.FirstError.Code.Should().Be("VALIDATION_ERROR");
        result.FirstError.Description.Should().Contain("Current password");
    }

    [Fact]
    public async Task UpdateProfileAsync_ChangeEmail_WrongPassword_ReturnsError()
    {
        var user = MakeUser();
        _userRepo.GetByIdAsync(TenantId, UserId, Arg.Any<CancellationToken>()).Returns(user);

        var result = await _sut.UpdateProfileAsync(
            TenantId,
            UserId,
            new UpdateProfileRequest(Email: "new@test.com", CurrentPassword: "WrongPassword!"),
            default
        );

        result.IsError.Should().BeTrue();
        result.FirstError.Description.Should().Contain("incorrect");
    }

    [Fact]
    public async Task UpdateProfileAsync_ChangeEmail_InvalidFormat_ReturnsError()
    {
        var user = MakeUser();
        _userRepo.GetByIdAsync(TenantId, UserId, Arg.Any<CancellationToken>()).Returns(user);

        var result = await _sut.UpdateProfileAsync(
            TenantId,
            UserId,
            new UpdateProfileRequest(Email: "not-an-email", CurrentPassword: "CurrentPassword1!"),
            default
        );

        result.IsError.Should().BeTrue();
        result.FirstError.Description.Should().Contain("email");
    }

    [Fact]
    public async Task UpdateProfileAsync_ChangeEmail_AlreadyTaken_ReturnsConflict()
    {
        var user = MakeUser();
        _userRepo.GetByIdAsync(TenantId, UserId, Arg.Any<CancellationToken>()).Returns(user);
        _userRepo
            .GetByEmailAsync("taken@test.com", Arg.Any<CancellationToken>())
            .Returns(new User { Id = Guid.NewGuid(), Email = "taken@test.com" });

        var result = await _sut.UpdateProfileAsync(
            TenantId,
            UserId,
            new UpdateProfileRequest(Email: "taken@test.com", CurrentPassword: "CurrentPassword1!"),
            default
        );

        result.IsError.Should().BeTrue();
        result.FirstError.Code.Should().Be("EMAIL_EXISTS");
    }

    [Fact]
    public async Task UpdateProfileAsync_ChangeEmail_Valid_UpdatesAndNormalizes()
    {
        var user = MakeUser();
        _userRepo.GetByIdAsync(TenantId, UserId, Arg.Any<CancellationToken>()).Returns(user);
        _userRepo
            .GetByEmailAsync("new@test.com", Arg.Any<CancellationToken>())
            .Returns((User?)null);

        var result = await _sut.UpdateProfileAsync(
            TenantId,
            UserId,
            new UpdateProfileRequest(Email: "New@Test.COM", CurrentPassword: "CurrentPassword1!"),
            default
        );

        result.IsError.Should().BeFalse();
        result.Value.Email.Should().Be("new@test.com");
    }

    // ── UpdateProfileAsync — Password ──

    [Fact]
    public async Task UpdateProfileAsync_ChangePassword_ExternalAccount_ReturnsError()
    {
        var user = MakeUser(withPassword: false);
        _userRepo.GetByIdAsync(TenantId, UserId, Arg.Any<CancellationToken>()).Returns(user);

        var result = await _sut.UpdateProfileAsync(
            TenantId,
            UserId,
            new UpdateProfileRequest(NewPassword: "NewPassword123!"),
            default
        );

        result.IsError.Should().BeTrue();
        result.FirstError.Description.Should().Contain("external sign-in");
    }

    [Fact]
    public async Task UpdateProfileAsync_ChangePassword_RequiresCurrentPassword()
    {
        var user = MakeUser();
        _userRepo.GetByIdAsync(TenantId, UserId, Arg.Any<CancellationToken>()).Returns(user);

        var result = await _sut.UpdateProfileAsync(
            TenantId,
            UserId,
            new UpdateProfileRequest(NewPassword: "NewPassword123!"),
            default
        );

        result.IsError.Should().BeTrue();
        result.FirstError.Description.Should().Contain("Current password");
    }

    [Fact]
    public async Task UpdateProfileAsync_ChangePassword_TooShort_ReturnsError()
    {
        var user = MakeUser();
        _userRepo.GetByIdAsync(TenantId, UserId, Arg.Any<CancellationToken>()).Returns(user);

        var result = await _sut.UpdateProfileAsync(
            TenantId,
            UserId,
            new UpdateProfileRequest(NewPassword: "short", CurrentPassword: "CurrentPassword1!"),
            default
        );

        result.IsError.Should().BeTrue();
        result.FirstError.Description.Should().Contain($"{Validator.MinPasswordLength}");
    }

    [Fact]
    public async Task UpdateProfileAsync_ChangePassword_Empty_ReturnsError()
    {
        var user = MakeUser();
        _userRepo.GetByIdAsync(TenantId, UserId, Arg.Any<CancellationToken>()).Returns(user);

        var result = await _sut.UpdateProfileAsync(
            TenantId,
            UserId,
            new UpdateProfileRequest(NewPassword: "  ", CurrentPassword: "CurrentPassword1!"),
            default
        );

        result.IsError.Should().BeTrue();
        result.FirstError.Description.Should().Contain("required");
    }

    [Fact]
    public async Task UpdateProfileAsync_ChangePassword_Valid_HashesNewPassword()
    {
        var user = MakeUser();
        _userRepo.GetByIdAsync(TenantId, UserId, Arg.Any<CancellationToken>()).Returns(user);

        var result = await _sut.UpdateProfileAsync(
            TenantId,
            UserId,
            new UpdateProfileRequest(
                NewPassword: "NewPassword123!",
                CurrentPassword: "CurrentPassword1!"
            ),
            default
        );

        result.IsError.Should().BeFalse();
        _passwordHasher.Verify("NewPassword123!", result.Value.PasswordHash!).Should().BeTrue();
    }

    // ── UpdateProfileAsync — Theme ──

    [Fact]
    public async Task UpdateProfileAsync_InvalidTheme_ReturnsError()
    {
        var user = MakeUser();
        _userRepo.GetByIdAsync(TenantId, UserId, Arg.Any<CancellationToken>()).Returns(user);

        var result = await _sut.UpdateProfileAsync(
            TenantId,
            UserId,
            new UpdateProfileRequest(ThemePreference: "neon"),
            default
        );

        result.IsError.Should().BeTrue();
        result.FirstError.Description.Should().Contain("light");
    }

    [Theory]
    [InlineData("light")]
    [InlineData("dark")]
    [InlineData("system")]
    public async Task UpdateProfileAsync_ValidTheme_UpdatesPreference(string theme)
    {
        var user = MakeUser();
        _userRepo.GetByIdAsync(TenantId, UserId, Arg.Any<CancellationToken>()).Returns(user);

        var result = await _sut.UpdateProfileAsync(
            TenantId,
            UserId,
            new UpdateProfileRequest(ThemePreference: theme),
            default
        );

        result.IsError.Should().BeFalse();
        result.Value.ThemePreference.Should().Be(theme);
    }

    // ── CompleteOnboardingAsync ──

    [Fact]
    public async Task CompleteOnboardingAsync_UserNotFound_ReturnsNotFound()
    {
        _userRepo.GetByIdAsync(TenantId, UserId, Arg.Any<CancellationToken>()).Returns((User?)null);

        var result = await _sut.CompleteOnboardingAsync(TenantId, UserId, default);

        result.IsError.Should().BeTrue();
        result.FirstError.Code.Should().Be("NOT_FOUND");
    }

    [Fact]
    public async Task CompleteOnboardingAsync_Valid_SetsFlag()
    {
        var user = MakeUser();
        _userRepo.GetByIdAsync(TenantId, UserId, Arg.Any<CancellationToken>()).Returns(user);

        var result = await _sut.CompleteOnboardingAsync(TenantId, UserId, default);

        result.IsError.Should().BeFalse();
        user.OnboardingCompleted.Should().BeTrue();
        await _userRepo.Received(1).UpdateAsync(user, Arg.Any<CancellationToken>());
    }
}
