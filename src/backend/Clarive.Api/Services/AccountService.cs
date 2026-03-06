using Clarive.Api.Auth;
using Clarive.Api.Data;
using Clarive.Api.Models.Entities;
using Clarive.Api.Models.Enums;
using Clarive.Api.Models.Results;
using Clarive.Api.Repositories.Interfaces;
using Clarive.Api.Services.Interfaces;

namespace Clarive.Api.Services;

public class AccountService(
    IUserRepository userRepo,
    ITenantRepository tenantRepo,
    ITenantMembershipRepository membershipRepo,
    IRefreshTokenRepository refreshTokenRepo,
    ITokenRepository tokenRepo,
    IInvitationRepository invitationRepo,
    IOnboardingSeeder onboardingSeeder,
    IGoogleAuthService googleAuthService,
    JwtService jwtService,
    PasswordHasher passwordHasher,
    IConfiguration configuration,
    ClariveDbContext db) : IAccountService
{
    public async Task<RegisterResult?> RegisterAsync(string email, string name, string password, CancellationToken ct)
    {
        if (await userRepo.GetByEmailAsync(email, ct) is not null)
            return null;

        await using var tx = await db.Database.BeginTransactionAsync(ct);

        var isFirstUser = !await userRepo.AnyUsersExistAsync(ct);
        var emailProvider = configuration["Email:Provider"] ?? "none";
        var skipVerification = isFirstUser
            || emailProvider.Equals("none", StringComparison.OrdinalIgnoreCase);

        var (user, tenant) = await CreateUserWithPersonalWorkspaceAsync(
            email.Trim().ToLowerInvariant(), name.Trim(),
            passwordHash: passwordHasher.Hash(password),
            googleId: null, emailVerified: skipVerification,
            isSuperUser: isFirstUser, ct);

        // Skip verification token when auto-verified (first user or no email provider)
        string? rawVerify = null;
        if (!skipVerification)
        {
            (rawVerify, _) = jwtService.GenerateRefreshToken();
            await tokenRepo.CreateVerificationTokenAsync(new EmailVerificationToken
            {
                Id = Guid.NewGuid(),
                UserId = user.Id,
                TokenHash = JwtService.HashRefreshToken(rawVerify),
                ExpiresAt = DateTime.UtcNow.AddHours(24),
                CreatedAt = DateTime.UtcNow
            }, ct);
        }

        await tx.CommitAsync(ct);

        return new RegisterResult(user, tenant, rawVerify);
    }

    public async Task<GoogleAuthResult> AuthenticateWithGoogleAsync(string idToken, CancellationToken ct)
    {
        var googleUser = await googleAuthService.ValidateIdTokenAsync(idToken, ct);

        // 1. Find by GoogleId — existing linked account
        var user = await userRepo.GetByGoogleIdAsync(googleUser.GoogleId, ct);
        if (user is not null)
            return new GoogleAuthResult(user, false);

        // 2. Find by email — reject silent linking (user must link from Settings)
        user = await userRepo.GetByEmailAsync(googleUser.Email, ct);
        if (user is not null)
        {
            throw new InvalidOperationException(
                "An account with this email already exists. " +
                "Please log in with your password and link Google from Settings.");
        }

        // 3. New user — create tenant + user (no password, email auto-verified)
        await using var tx = await db.Database.BeginTransactionAsync(ct);

        (user, _) = await CreateUserWithPersonalWorkspaceAsync(
            googleUser.Email.Trim().ToLowerInvariant(), googleUser.Name,
            passwordHash: null, googleId: googleUser.GoogleId,
            emailVerified: true, ct: ct);

        await tx.CommitAsync(ct);

        return new GoogleAuthResult(user, true);
    }

    public async Task<RefreshResult?> RefreshTokensAsync(string refreshToken, CancellationToken ct)
    {
        var tokenHash = JwtService.HashRefreshToken(refreshToken);
        var existing = await refreshTokenRepo.GetByHashAsync(tokenHash, ct);

        if (existing is null || existing.RevokedAt is not null || existing.ExpiresAt < DateTime.UtcNow)
            return null;

        var user = await userRepo.GetByIdCrossTenantsAsync(existing.UserId, ct);
        if (user is null)
            return null;

        // Validate user still has membership in their active workspace
        var activeMembership = await membershipRepo.GetAsync(user.Id, user.TenantId, ct);
        if (activeMembership is null)
        {
            // Active workspace membership revoked — fall back to personal workspace
            var memberships = await membershipRepo.GetByUserIdAsync(user.Id, ct);
            var personal = memberships.FirstOrDefault(m => m.IsPersonal);
            if (personal is null)
                return null;

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

        await refreshTokenRepo.CreateAsync(new RefreshToken
        {
            Id = newTokenId,
            UserId = user.Id,
            TokenHash = newHash,
            ExpiresAt = DateTime.UtcNow.AddDays(jwtService.RefreshTokenExpirationDays),
            CreatedAt = DateTime.UtcNow
        }, ct);

        var accessToken = jwtService.GenerateToken(user);
        return new RefreshResult(user, accessToken, rawRefresh, newTokenId);
    }

    public async Task<InvitationAcceptResult?> AcceptInvitationAsync(
        string invitationToken, string name, string password, CancellationToken ct)
    {
        var tokenHash = JwtService.HashRefreshToken(invitationToken);
        var invitation = await invitationRepo.GetByTokenHashAsync(tokenHash, ct);

        if (invitation is null || invitation.ExpiresAt <= DateTime.UtcNow)
            return null;

        if (await userRepo.GetByEmailAsync(invitation.Email, ct) is not null)
            return null;

        await using var tx = await db.Database.BeginTransactionAsync(ct);

        // Create user in the invited workspace
        var user = await userRepo.CreateAsync(new User
        {
            Id = Guid.NewGuid(),
            TenantId = invitation.TenantId,
            Email = invitation.Email,
            Name = name.Trim(),
            PasswordHash = passwordHasher.Hash(password),
            Role = invitation.Role,
            EmailVerified = true,
            CreatedAt = DateTime.UtcNow
        }, ct);

        // Create personal workspace
        var personalTenant = await tenantRepo.CreateAsync(new Tenant
        {
            Id = Guid.NewGuid(),
            Name = $"{name.Trim()}'s workspace",
            OwnerId = user.Id,
            CreatedAt = DateTime.UtcNow
        }, ct);

        // Create personal workspace membership
        await membershipRepo.CreateAsync(new TenantMembership
        {
            Id = Guid.NewGuid(),
            UserId = user.Id,
            TenantId = personalTenant.Id,
            Role = UserRole.Admin,
            IsPersonal = true,
            JoinedAt = DateTime.UtcNow
        }, ct);

        // Create invited workspace membership
        await membershipRepo.CreateAsync(new TenantMembership
        {
            Id = Guid.NewGuid(),
            UserId = user.Id,
            TenantId = invitation.TenantId,
            Role = invitation.Role,
            IsPersonal = false,
            JoinedAt = DateTime.UtcNow
        }, ct);

        // Seed starter templates in personal workspace
        await onboardingSeeder.SeedStarterTemplatesAsync(personalTenant.Id, user.Id, ct);

        await invitationRepo.DeleteAsync(invitation.TenantId, invitation.Id, ct);

        // Generate tokens
        var (rawRefresh, refreshHash) = jwtService.GenerateRefreshToken();
        var refreshTokenId = Guid.NewGuid();
        await refreshTokenRepo.CreateAsync(new RefreshToken
        {
            Id = refreshTokenId,
            UserId = user.Id,
            TokenHash = refreshHash,
            ExpiresAt = DateTime.UtcNow.AddDays(jwtService.RefreshTokenExpirationDays),
            CreatedAt = DateTime.UtcNow
        }, ct);

        await tx.CommitAsync(ct);

        var accessToken = jwtService.GenerateToken(user);
        return new InvitationAcceptResult(user, accessToken, rawRefresh, refreshTokenId);
    }

    /// <summary>
    /// Shared transaction logic: creates a user, personal tenant, membership, and seeds templates.
    /// Must be called within an active transaction.
    /// </summary>
    private async Task<(User User, Tenant Tenant)> CreateUserWithPersonalWorkspaceAsync(
        string email, string name, string? passwordHash, string? googleId,
        bool emailVerified, bool isSuperUser = false, CancellationToken ct = default)
    {
        var tenant = await tenantRepo.CreateAsync(new Tenant
        {
            Id = Guid.NewGuid(),
            Name = $"{name}'s workspace",
            CreatedAt = DateTime.UtcNow
        }, ct);

        var user = await userRepo.CreateAsync(new User
        {
            Id = Guid.NewGuid(),
            TenantId = tenant.Id,
            Email = email,
            Name = name,
            PasswordHash = passwordHash,
            GoogleId = googleId,
            EmailVerified = emailVerified,
            IsSuperUser = isSuperUser,
            Role = UserRole.Admin,
            CreatedAt = DateTime.UtcNow
        }, ct);

        tenant.OwnerId = user.Id;
        await tenantRepo.UpdateAsync(tenant, ct);

        await membershipRepo.CreateAsync(new TenantMembership
        {
            Id = Guid.NewGuid(),
            UserId = user.Id,
            TenantId = tenant.Id,
            Role = UserRole.Admin,
            IsPersonal = true,
            JoinedAt = DateTime.UtcNow
        }, ct);

        await onboardingSeeder.SeedStarterTemplatesAsync(tenant.Id, user.Id, ct);

        return (user, tenant);
    }
}
