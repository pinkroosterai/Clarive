using Clarive.Application.Tags.Contracts;
using Clarive.Domain.Interfaces.Repositories;
using Clarive.Domain.Interfaces.Services;
using Clarive.Infrastructure.Cache;
using ErrorOr;

namespace Clarive.Application.Tags.Services;

public class TagService(ITagRepository tagRepo, ITenantCacheService cache) : ITagService
{
    private const int MaxTagNameLength = 50;

    public async Task<List<TagSummary>> GetAllAsync(Guid tenantId, CancellationToken ct = default)
    {
        var tags = await cache.GetOrCreateAsync(
            TenantCacheKeys.WorkspaceTagsKey,
            tenantId,
            _ => tagRepo.GetAllWithCountsAsync(tenantId, ct),
            TenantCacheKeys.WorkspaceTagsTtl,
            ct
        );

        return tags.Select(t => new TagSummary(t.TagName, t.EntryCount)).ToList();
    }

    public async Task<ErrorOr<Updated>> RenameAsync(
        Guid tenantId,
        string oldName,
        string newName,
        CancellationToken ct = default
    )
    {
        var normalizedOld = Normalize(oldName);
        var normalizedNew = Normalize(newName);

        var validationError = Validate(normalizedNew);
        if (validationError is not null)
            return Error.Validation("VALIDATION_ERROR", validationError);

        if (normalizedOld == normalizedNew)
            return Result.Updated;

        await tagRepo.RenameAsync(tenantId, normalizedOld!, normalizedNew!, ct);
        await TenantCacheKeys.EvictTagData(cache, tenantId);

        return Result.Updated;
    }

    public async Task DeleteAsync(Guid tenantId, string tagName, CancellationToken ct = default)
    {
        var normalized = Normalize(tagName);
        await tagRepo.DeleteAsync(tenantId, normalized!, ct);
        await TenantCacheKeys.EvictTagData(cache, tenantId);
    }

    public async Task<List<string>> GetByEntryIdAsync(
        Guid tenantId,
        Guid entryId,
        CancellationToken ct = default
    )
    {
        return await tagRepo.GetByEntryIdAsync(tenantId, entryId, ct);
    }

    private static string? Normalize(string? name) => name?.Trim().ToLowerInvariant();

    private static string? Validate(string? name)
    {
        if (string.IsNullOrWhiteSpace(name))
            return "Tag name is required.";
        if (name.Length > MaxTagNameLength)
            return $"Tag name must be {MaxTagNameLength} characters or fewer.";
        if (!TagValidation.TagNamePattern().IsMatch(name))
            return "Tag name can only contain lowercase letters, numbers, hyphens, and spaces.";
        return null;
    }
}
