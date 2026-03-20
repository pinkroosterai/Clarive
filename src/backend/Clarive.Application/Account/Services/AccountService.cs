using Clarive.Domain.Interfaces.Services;
using Clarive.Auth.Google;
using Clarive.Auth.Jwt;
using Clarive.Infrastructure.Security;
using Clarive.Infrastructure.Data;
using Clarive.Domain.Entities;
using Clarive.Domain.Enums;
using Clarive.Domain.Interfaces.Repositories;
using ErrorOr;
using Microsoft.EntityFrameworkCore;

namespace Clarive.Application.Account.Services;

public class AccountService(
    IUserRepository userRepo,
    ITenantRepository tenantRepo,
    ITenantMembershipRepository membershipRepo,
    IRefreshTokenRepository refreshTokenRepo,
    ITokenRepository tokenRepo,
    IInvitationRepository invitationRepo,
    IGoogleAuthService googleAuthService,
    JwtService jwtService,
    PasswordHasher passwordHasher,
    IConfiguration configuration,
    ClariveDbContext db,
    ITokenIssuanceService tokenIssuance,
    IUserWorkspaceCreationService workspaceCreation
) : IAccountService
{
    public async Task<ErrorOr<LoginResult>> LoginAsync(
        string email,
        string password,
        CancellationToken ct
    )
    {
        var user = await userRepo.GetByEmailAsync(email, ct);
        if (
            user is null
            || user.PasswordHash is null
            || !passwordHasher.Verify(password, user.PasswordHash)
        )
            return Error.Unauthorized("INVALID_CREDENTIALS", "Email or password is incorrect.");

        var (accessToken, rawRefresh, refreshTokenId) = await tokenIssuance.IssueTokensAsync(
            user,
            ct
        );
        return new LoginResult(user, accessToken, rawRefresh, refreshTokenId);
    }

    public async Task<ErrorOr<RegisterResult>> RegisterAsync(
        string email,
        string name,
        string password,
        CancellationToken ct
    )
    {
        if (await userRepo.GetByEmailAsync(email, ct) is not null)
            return Error.Conflict("EMAIL_ALREADY_EXISTS", "A user with this email already exists.");

        try
        {
            return await db.Database.InTransactionAsync(
                async () =>
                {
                    var isFirstUser = !await userRepo.AnyUsersExistAsync(ct);
                    var emailProvider = configuration["Email:Provider"] ?? "none";
                    var skipVerification =
                        isFirstUser
                        || emailProvider.Equals("none", StringComparison.OrdinalIgnoreCase);

                    var (user, tenant) =
                        await workspaceCreation.CreateUserWithPersonalWorkspaceAsync(
                            email.Trim().ToLowerInvariant(),
                            name.Trim(),
                            passwordHash: passwordHasher.Hash(password),
                            googleId: null,
                            emailVerified: skipVerification,
                            isSuperUser: isFirstUser,
                            ct
                        );

                    // Skip verification token when auto-verified (first user or no email provider)
                    string? rawVerify = null;
                    if (!skipVerification)
                    {
                        (rawVerify, _) = jwtService.GenerateRefreshToken();
                        await tokenRepo.CreateVerificationTokenAsync(
                            new EmailVerificationToken
                            {
                                Id = Guid.NewGuid(),
                                UserId = user.Id,
                                TokenHash = JwtService.HashRefreshToken(rawVerify),
                                ExpiresAt = DateTime.UtcNow.AddHours(24),
                                CreatedAt = DateTime.UtcNow,
                            },
                            ct
                        );
                    }

                    var (accessToken, rawRefresh, refreshTokenId) =
                        await tokenIssuance.IssueTokensAsync(user, ct);

                    return (ErrorOr<RegisterResult>)
                        new RegisterResult(
                            user,
                            tenant,
                            rawVerify,
                            accessToken,
                            rawRefresh,
                            refreshTokenId
                        );
                },
                ct
            );
        }
        catch (DbUpdateException)
        {
            // Unique constraint violation on email — concurrent registration won the race
            return Error.Conflict(
                "CONCURRENT_REGISTRATION",
                "Unable to create account. Please try again."
            );
        }
    }

    public async Task<ErrorOr<GoogleAuthLoginResult>> LoginWithGoogleAsync(
        string idToken,
        string? nonce = null,
        CancellationToken ct = default
    )
    {
        GoogleUserInfo googleUser;
        try
        {
            googleUser = await googleAuthService.ValidateIdTokenAsync(idToken, nonce, ct);
        }
        catch (Exception)
        {
            return Error.Unauthorized(
                "INVALID_GOOGLE_TOKEN",
                "Google ID token is invalid or expired."
            );
        }

        // 1. Find by GoogleId — existing linked account
        var user = await userRepo.GetByGoogleIdAsync(googleUser.GoogleId, ct);
        if (user is not null)
        {
            var (accessToken, rawRefresh, refreshTokenId) =
                await tokenIssuance.IssueTokensAsync(user, ct);
            return new GoogleAuthLoginResult(user, accessToken, rawRefresh, refreshTokenId, false);
        }

        // 2. Find by email — reject silent linking (user must link from Settings)
        user = await userRepo.GetByEmailAsync(googleUser.Email, ct);
        if (user is not null)
        {
            return Error.Conflict(
                "EMAIL_CONFLICT",
                "An account with this email already exists. "
                    + "Please log in with your password and link Google from Settings."
            );
        }

        // 3. New user — create tenant + user (no password, email auto-verified)
        return await db.Database.InTransactionAsync(
            async () =>
            {
                (user, _) = await workspaceCreation.CreateUserWithPersonalWorkspaceAsync(
                    googleUser.Email.Trim().ToLowerInvariant(),
                    googleUser.Name,
                    passwordHash: null,
                    googleId: googleUser.GoogleId,
                    emailVerified: true,
                    ct: ct
                );

                var (at, rr, rtId) = await tokenIssuance.IssueTokensAsync(user, ct);

                return (ErrorOr<GoogleAuthLoginResult>)
                    new GoogleAuthLoginResult(user, at, rr, rtId, true);
            },
            ct
        );
    }

    public async Task<ErrorOr<RefreshResult>> RefreshTokensAsync(
        string refreshToken,
        CancellationToken ct
    )
    {
        var tokenHash = JwtService.HashRefreshToken(refreshToken);
        var existing = await refreshTokenRepo.GetByHashAsync(tokenHash, ct);

        if (
            existing is null
            || existing.RevokedAt is not null
            || existing.ExpiresAt < DateTime.UtcNow
        )
            return Error.Unauthorized(
                "INVALID_REFRESH_TOKEN",
                "Refresh token is invalid or expired."
            );

        var user = await userRepo.GetByIdCrossTenantsAsync(existing.UserId, ct);
        if (user is null)
            return Error.Unauthorized(
                "INVALID_REFRESH_TOKEN",
                "Refresh token is invalid or expired."
            );

        // Validate user still has membership in their active workspace
        var activeMembership = await membershipRepo.GetAsync(user.Id, user.TenantId, ct);
        if (activeMembership is null)
        {
            // Active workspace membership revoked — fall back to personal workspace
            var memberships = await membershipRepo.GetByUserIdAsync(user.Id, ct);
            var personal = memberships.FirstOrDefault(m => m.IsPersonal);
            if (personal is null)
                return Error.Unauthorized(
                    "INVALID_REFRESH_TOKEN",
                    "Refresh token is invalid or expired."
                );

            user.TenantId = personal.TenantId;
            user.Role = personal.Role;
            await userRepo.UpdateAsync(user, ct);
        }
        else if (user.Role != activeMembership.Role)
        {
            // Sync role from membership (may have changed since last token)
            user.Role = activeMembership.Role;
            await userRepo.UpdateAsync(user, ct);
        }

        // Rotate: create new refresh token, revoke old one
        var (rawRefresh, newHash) = jwtService.GenerateRefreshToken();
        var newTokenId = Guid.NewGuid();

        await refreshTokenRepo.RevokeAsync(existing.Id, newTokenId, ct);

        await refreshTokenRepo.CreateAsync(
            new RefreshToken
            {
                Id = newTokenId,
                UserId = user.Id,
                TokenHash = newHash,
                ExpiresAt = DateTime.UtcNow.AddDays(jwtService.RefreshTokenExpirationDays),
                CreatedAt = DateTime.UtcNow,
            },
            ct
        );

        var accessToken = jwtService.GenerateToken(user);
        return new RefreshResult(user, accessToken, rawRefresh, newTokenId);
    }

    public async Task<ErrorOr<InvitationAcceptResult>> AcceptInvitationAsync(
        string invitationToken,
        string name,
        string password,
        CancellationToken ct
    )
    {
        var tokenHash = JwtService.HashRefreshToken(invitationToken);
        var invitation = await invitationRepo.GetByTokenHashAsync(tokenHash, ct);

        if (invitation is null || invitation.ExpiresAt <= DateTime.UtcNow)
            return Error.NotFound(
                "INVALID_INVITATION",
                "This invitation is invalid or has expired."
            );

        if (await userRepo.GetByEmailAsync(invitation.Email, ct) is not null)
            return Error.Conflict("EMAIL_ALREADY_EXISTS", "A user with this email already exists.");

        return await db.Database.InTransactionAsync(
            async () =>
            {
                // Create user in the invited workspace
                var user = await userRepo.CreateAsync(
                    new User
                    {
                        Id = Guid.NewGuid(),
                        TenantId = invitation.TenantId,
                        Email = invitation.Email,
                        Name = name.Trim(),
                        PasswordHash = passwordHasher.Hash(password),
                        Role = invitation.Role,
                        EmailVerified = true,
                        CreatedAt = DateTime.UtcNow,
                    },
                    ct
                );

                // Create personal workspace
                var personalTenant = await tenantRepo.CreateAsync(
                    new Tenant
                    {
                        Id = Guid.NewGuid(),
                        Name = $"{name.Trim()}'s workspace",
                        OwnerId = user.Id,
                        CreatedAt = DateTime.UtcNow,
                    },
                    ct
                );

                // Create personal workspace membership
                await membershipRepo.CreateAsync(
                    new TenantMembership
                    {
                        Id = Guid.NewGuid(),
                        UserId = user.Id,
                        TenantId = personalTenant.Id,
                        Role = UserRole.Admin,
                        IsPersonal = true,
                        JoinedAt = DateTime.UtcNow,
                    },
                    ct
                );

                // Create invited workspace membership
                await membershipRepo.CreateAsync(
                    new TenantMembership
                    {
                        Id = Guid.NewGuid(),
                        UserId = user.Id,
                        TenantId = invitation.TenantId,
                        Role = invitation.Role,
                        IsPersonal = false,
                        JoinedAt = DateTime.UtcNow,
                    },
                    ct
                );

                // Seed starter templates in personal workspace
                await workspaceCreation.SeedStarterTemplatesAsync(
                    personalTenant.Id,
                    user.Id,
                    ct
                );

                await invitationRepo.DeleteAsync(invitation.TenantId, invitation.Id, ct);

                var (accessToken, rawRefresh, refreshTokenId) =
                    await tokenIssuance.IssueTokensAsync(user, ct);

                return (ErrorOr<InvitationAcceptResult>)
                    new InvitationAcceptResult(user, accessToken, rawRefresh, refreshTokenId);
            },
            ct
        );
    }
}
