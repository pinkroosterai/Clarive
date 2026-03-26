using Clarive.Domain.Entities;

namespace Clarive.Application.Account.Contracts;

public interface IUserWorkspaceCreationService
{
    /// <summary>
    /// Creates a user with a personal workspace, membership, and seeds starter templates.
    /// Must be called within an active transaction.
    /// </summary>
    Task<(User User, Tenant PersonalWorkspace)> CreateUserWithPersonalWorkspaceAsync(
        string email,
        string name,
        string? passwordHash,
        string? googleId,
        bool emailVerified,
        bool isSuperUser = false,
        string? gitHubId = null,
        CancellationToken ct = default
    );

    /// <summary>
    /// Seeds starter templates in a workspace. Used by invitation acceptance flow
    /// where the user/workspace are created separately.
    /// </summary>
    Task SeedStarterTemplatesAsync(Guid tenantId, Guid userId, CancellationToken ct);
}
