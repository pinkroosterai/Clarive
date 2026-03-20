using Clarive.Infrastructure.Security;
using System.Security.Cryptography;
using System.Text;
using Clarive.Domain.Errors;
using Clarive.Domain.Entities;
using Clarive.Domain.Interfaces.Repositories;
using ErrorOr;

namespace Clarive.Application.ShareLinks.Services;

public class ShareLinkService(
    IShareLinkRepository shareLinkRepo,
    IEntryRepository entryRepo,
    PasswordHasher passwordHasher
) : IShareLinkService
{
    public async Task<ErrorOr<ShareLinkResult>> CreateAsync(
        Guid tenantId,
        Guid entryId,
        Guid userId,
        DateTime? expiresAt = null,
        string? password = null,
        int? pinnedVersion = null,
        CancellationToken ct = default
    )
    {
        var entry = await entryRepo.GetByIdAsync(tenantId, entryId, ct);
        if (entry is null)
            return DomainErrors.EntryNotFoundByCode;

        if (entry.IsTrashed)
            return Error.Validation(
                "ENTRY_TRASHED",
                "Cannot create a share link for a trashed entry."
            );

        // Verify entry has a published version
        var published = await entryRepo.GetPublishedVersionAsync(tenantId, entryId, ct);
        if (published is null)
            return Error.Validation(
                "NO_PUBLISHED_VERSION",
                "Entry must have a published version to share."
            );

        // If pinned version specified, verify it exists
        if (pinnedVersion.HasValue)
        {
            var version = await entryRepo.GetVersionAsync(
                tenantId,
                entryId,
                pinnedVersion.Value,
                ct
            );
            if (version is null)
                return Error.NotFound(
                    "VERSION_NOT_FOUND",
                    $"Version {pinnedVersion.Value} not found."
                );
        }

        // Remove existing share link for this entry (one-link-per-entry)
        await shareLinkRepo.DeleteByEntryIdAsync(tenantId, entryId, ct);

        // Generate token
        var (rawToken, tokenHash) = GenerateShareToken();

        var shareLink = new ShareLink
        {
            Id = Guid.NewGuid(),
            TenantId = tenantId,
            EntryId = entryId,
            TokenHash = tokenHash,
            Token = rawToken,
            CreatedBy = userId,
            CreatedAt = DateTime.UtcNow,
            ExpiresAt = expiresAt,
            PasswordHash = password is not null ? passwordHasher.Hash(password) : null,
            PinnedVersion = pinnedVersion,
            AccessCount = 0,
            IsActive = true,
        };

        await shareLinkRepo.CreateAsync(shareLink, ct);
        return new ShareLinkResult(rawToken, shareLink);
    }

    public async Task<ErrorOr<ShareLink>> GetByEntryIdAsync(
        Guid tenantId,
        Guid entryId,
        CancellationToken ct = default
    )
    {
        var link = await shareLinkRepo.GetByEntryIdAsync(tenantId, entryId, ct);
        if (link is null)
            return DomainErrors.ShareLinkNotFound;
        return link;
    }

    public async Task<ErrorOr<Success>> RevokeAsync(
        Guid tenantId,
        Guid entryId,
        CancellationToken ct = default
    )
    {
        var deleted = await shareLinkRepo.DeleteByEntryIdAsync(tenantId, entryId, ct);
        if (!deleted)
            return DomainErrors.ShareLinkNotFoundForEntry;
        return Result.Success;
    }

    public async Task<ErrorOr<SharedEntryResult>> GetPublicEntryByTokenAsync(
        string rawToken,
        CancellationToken ct = default
    )
    {
        var tokenHash = HashToken(rawToken);
        var link = await shareLinkRepo.GetByTokenHashAsync(tokenHash, ct);

        if (link is null || !link.IsActive)
            return DomainErrors.ShareLinkNotFoundOrInactive;

        if (link.ExpiresAt.HasValue && link.ExpiresAt.Value <= DateTime.UtcNow)
            return Error.Custom(410, "SHARE_LINK_EXPIRED", "This share link has expired.");

        // If password-protected, return a signal that password is required
        if (link.PasswordHash is not null)
            return new SharedEntryResult(
                link.EntryId,
                "",
                null,
                0,
                null,
                [],
                PasswordRequired: true
            );

        return await ResolveEntryForLink(link, ct);
    }

    public async Task<ErrorOr<SharedEntryResult>> VerifyPasswordAndGetEntryAsync(
        string rawToken,
        string password,
        CancellationToken ct = default
    )
    {
        var tokenHash = HashToken(rawToken);
        var link = await shareLinkRepo.GetByTokenHashAsync(tokenHash, ct);

        if (link is null || !link.IsActive)
            return DomainErrors.ShareLinkNotFoundOrInactive;

        if (link.ExpiresAt.HasValue && link.ExpiresAt.Value <= DateTime.UtcNow)
            return Error.Custom(410, "SHARE_LINK_EXPIRED", "This share link has expired.");

        if (link.PasswordHash is null)
            return await ResolveEntryForLink(link, ct);

        if (!passwordHasher.Verify(password, link.PasswordHash))
            return Error.Unauthorized("INVALID_PASSWORD", "Incorrect password.");

        return await ResolveEntryForLink(link, ct);
    }

    private async Task<ErrorOr<SharedEntryResult>> ResolveEntryForLink(
        ShareLink link,
        CancellationToken ct
    )
    {
        await shareLinkRepo.IncrementAccessCountAsync(link.Id, ct);

        // Resolve version: pinned or latest published
        // Use IgnoreQueryFilters equivalent: pass the link's TenantId
        PromptEntryVersion? version;
        if (link.PinnedVersion.HasValue)
        {
            version = await entryRepo.GetVersionAsync(
                link.TenantId,
                link.EntryId,
                link.PinnedVersion.Value,
                ct
            );
        }
        else
        {
            version = await entryRepo.GetPublishedVersionAsync(link.TenantId, link.EntryId, ct);
        }

        if (version is null)
            return DomainErrors.SharedVersionNotFound;

        // Get entry for title
        var entry = await entryRepo.GetByIdAsync(link.TenantId, link.EntryId, ct);
        if (entry is null || entry.IsTrashed)
            return DomainErrors.SharedEntryNotFound;

        var prompts = version
            .Prompts.OrderBy(p => p.Order)
            .Select(p => new SharedPrompt(
                p.Content,
                p.Order,
                p.IsTemplate,
                p.IsTemplate && p.TemplateFields.Count > 0 ? p.TemplateFields : null
            ))
            .ToList();

        return new SharedEntryResult(
            entry.Id,
            entry.Title,
            version.SystemMessage,
            version.Version,
            version.PublishedAt,
            prompts,
            PasswordRequired: false
        );
    }

    private static (string RawToken, string TokenHash) GenerateShareToken()
    {
        var bytes = RandomNumberGenerator.GetBytes(32);
        var rawToken =
            "sl_" + Convert.ToBase64String(bytes).Replace("+", "-").Replace("/", "_").TrimEnd('=');
        var hash = SHA256.HashData(Encoding.UTF8.GetBytes(rawToken));
        var tokenHash = Convert.ToHexStringLower(hash);
        return (rawToken, tokenHash);
    }

    private static string HashToken(string rawToken)
    {
        var hash = SHA256.HashData(Encoding.UTF8.GetBytes(rawToken));
        return Convert.ToHexStringLower(hash);
    }
}
