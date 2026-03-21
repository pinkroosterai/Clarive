using Clarive.Infrastructure.Security;
using Clarive.Domain.Errors;
using Clarive.Domain.Entities;
using Clarive.Domain.ValueObjects;
using Clarive.Domain.Interfaces.Repositories;
using ErrorOr;
using Microsoft.Extensions.Logging;

namespace Clarive.Application.Profile.Services;

public class ProfileService(IUserRepository userRepo, PasswordHasher passwordHasher, ILogger<ProfileService> logger)
    : IProfileService
{
    private static readonly HashSet<string> ValidThemePreferences = ["light", "dark", "system"];

    public async Task<ErrorOr<User>> UpdateProfileAsync(
        Guid tenantId,
        Guid userId,
        UpdateProfileRequest request,
        CancellationToken ct
    )
    {
        var user = await userRepo.GetByIdAsync(tenantId, userId, ct);
        if (user is null)
            return DomainErrors.UserNotFound;

        // Validate current password when changing email or password
        if (request.NewPassword is not null && user.PasswordHash is null)
            return Error.Validation(
                "VALIDATION_ERROR",
                "Password changes are not available for accounts using external sign-in."
            );

        if (
            (request.Email is not null || request.NewPassword is not null)
            && string.IsNullOrWhiteSpace(request.CurrentPassword)
        )
            return Error.Validation(
                "VALIDATION_ERROR",
                "Current password is required to change email or password."
            );

        if (
            request.CurrentPassword is not null
            && (
                user.PasswordHash is null
                || !passwordHasher.Verify(request.CurrentPassword, user.PasswordHash)
            )
        )
            return Error.Validation("VALIDATION_ERROR", "Current password is incorrect.");

        // Apply name update
        if (request.Name is not null)
        {
            if (request.Name.Length > 255)
                return Error.Validation(
                    "VALIDATION_ERROR",
                    "Name must be 255 characters or fewer."
                );
            user.Name = request.Name;
        }

        // Apply email update
        if (request.Email is not null)
        {
            if (!Validator.IsValidEmail(request.Email))
                return Error.Validation("VALIDATION_ERROR", "Invalid email format.");

            var existing = await userRepo.GetByEmailAsync(request.Email, ct);
            if (existing is not null && existing.Id != user.Id)
                return Error.Conflict("EMAIL_EXISTS", "An account with this email already exists.");

            user.Email = request.Email.Trim().ToLowerInvariant();
        }

        // Apply password update
        if (request.NewPassword is not null)
        {
            if (string.IsNullOrWhiteSpace(request.NewPassword))
                return Error.Validation("VALIDATION_ERROR", "Password is required.");
            if (request.NewPassword.Length < Validator.MinPasswordLength)
                return Error.Validation(
                    "VALIDATION_ERROR",
                    $"Password must be at least {Validator.MinPasswordLength} characters."
                );
            user.PasswordHash = passwordHasher.Hash(request.NewPassword);
        }

        // Apply theme preference update
        if (request.ThemePreference is not null)
        {
            if (!ValidThemePreferences.Contains(request.ThemePreference))
                return Error.Validation(
                    "VALIDATION_ERROR",
                    "Theme preference must be 'light', 'dark', or 'system'."
                );
            user.ThemePreference = request.ThemePreference;
        }

        await userRepo.UpdateAsync(user, ct);
        logger.LogInformation("Profile updated for user {UserId}", userId);
        return user;
    }

    public async Task<ErrorOr<Success>> CompleteOnboardingAsync(
        Guid tenantId,
        Guid userId,
        CancellationToken ct
    )
    {
        var user = await userRepo.GetByIdAsync(tenantId, userId, ct);
        if (user is null)
            return DomainErrors.UserNotFound;

        user.OnboardingCompleted = true;
        await userRepo.UpdateAsync(user, ct);

        return Result.Success;
    }
}
