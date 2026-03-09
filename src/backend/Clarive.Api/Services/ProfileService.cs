using Clarive.Api.Auth;
using Clarive.Api.Models.Entities;
using Clarive.Api.Models.Requests;
using Clarive.Api.Repositories.Interfaces;
using Clarive.Api.Services.Interfaces;

namespace Clarive.Api.Services;

public class ProfileService(
    IUserRepository userRepo,
    PasswordHasher passwordHasher) : IProfileService
{
    private static readonly HashSet<string> ValidThemePreferences = ["light", "dark", "system"];

    public async Task<(User? User, string? ErrorCode, string? Message)> UpdateProfileAsync(
        Guid tenantId, Guid userId, UpdateProfileRequest request, CancellationToken ct)
    {
        var user = await userRepo.GetByIdAsync(tenantId, userId, ct);
        if (user is null)
            return (null, "NOT_FOUND", "User not found.");

        // Validate current password when changing email or password
        if (request.NewPassword is not null && user.PasswordHash is null)
            return (null, "VALIDATION_ERROR", "Password changes are not available for accounts using external sign-in.");

        if ((request.Email is not null || request.NewPassword is not null)
            && string.IsNullOrWhiteSpace(request.CurrentPassword))
            return (null, "VALIDATION_ERROR", "Current password is required to change email or password.");

        if (request.CurrentPassword is not null
            && (user.PasswordHash is null || !passwordHasher.Verify(request.CurrentPassword, user.PasswordHash)))
            return (null, "VALIDATION_ERROR", "Current password is incorrect.");

        // Apply name update
        if (request.Name is not null)
        {
            if (request.Name.Length > 255)
                return (null, "VALIDATION_ERROR", "Name must be 255 characters or fewer.");
            user.Name = request.Name;
        }

        // Apply email update
        if (request.Email is not null)
        {
            if (!Validator.IsValidEmail(request.Email))
                return (null, "VALIDATION_ERROR", "Invalid email format.");

            var existing = await userRepo.GetByEmailAsync(request.Email, ct);
            if (existing is not null && existing.Id != user.Id)
                return (null, "EMAIL_EXISTS", "An account with this email already exists.");

            user.Email = request.Email.Trim().ToLowerInvariant();
        }

        // Apply password update
        if (request.NewPassword is not null)
        {
            if (string.IsNullOrWhiteSpace(request.NewPassword))
                return (null, "VALIDATION_ERROR", "Password is required.");
            if (request.NewPassword.Length < Validator.MinPasswordLength)
                return (null, "VALIDATION_ERROR", $"Password must be at least {Validator.MinPasswordLength} characters.");
            user.PasswordHash = passwordHasher.Hash(request.NewPassword);
        }

        // Apply theme preference update
        if (request.ThemePreference is not null)
        {
            if (!ValidThemePreferences.Contains(request.ThemePreference))
                return (null, "VALIDATION_ERROR", "Theme preference must be 'light', 'dark', or 'system'.");
            user.ThemePreference = request.ThemePreference;
        }

        await userRepo.UpdateAsync(user, ct);
        return (user, null, null);
    }

    public async Task<(bool Success, string? ErrorCode, string? Message)> CompleteOnboardingAsync(
        Guid tenantId, Guid userId, CancellationToken ct)
    {
        var user = await userRepo.GetByIdAsync(tenantId, userId, ct);
        if (user is null)
            return (false, "NOT_FOUND", "User not found.");

        user.OnboardingCompleted = true;
        await userRepo.UpdateAsync(user, ct);

        return (true, null, null);
    }
}
