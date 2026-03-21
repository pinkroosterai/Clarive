using Clarive.Application.Entries.Contracts;
using Clarive.Application.Tags.Contracts;
using Clarive.Domain.Errors;
using Clarive.Domain.Interfaces.Repositories;
using Clarive.Infrastructure.Cache;
using ErrorOr;

namespace Clarive.Application.Entries.Services;

public class EntryTagService(
    IEntryRepository entryRepo,
    ITagRepository tagRepo,
    TenantCacheService cache
) : IEntryTagService
{
    private const int MaxTagNameLength = 50;

    public async Task<ErrorOr<List<string>>> GetEntryTagsAsync(
        Guid tenantId,
        Guid entryId,
        CancellationToken ct
    )
    {
        var entry = await entryRepo.GetByIdAsync(tenantId, entryId, ct);
        if (entry is null)
            return DomainErrors.EntryNotFound;

        return await tagRepo.GetByEntryIdAsync(tenantId, entryId, ct);
    }

    public async Task<ErrorOr<List<string>>> AddEntryTagsAsync(
        Guid tenantId,
        Guid entryId,
        List<string> tagNames,
        CancellationToken ct
    )
    {
        var entry = await entryRepo.GetByIdAsync(tenantId, entryId, ct);
        if (entry is null)
            return DomainErrors.EntryNotFound;

        if (tagNames is null || tagNames.Count == 0)
            return Error.Validation("VALIDATION_ERROR", "At least one tag is required.");

        var normalized = new List<string>();
        foreach (var tag in tagNames)
        {
            var name = tag.Trim().ToLowerInvariant();
            if (
                string.IsNullOrWhiteSpace(name)
                || name.Length > MaxTagNameLength
                || !TagValidation.TagNamePattern().IsMatch(name)
            )
                return Error.Validation(
                    "VALIDATION_ERROR",
                    $"Invalid tag name: '{tag}'. Tags can only contain lowercase letters, numbers, hyphens, and spaces."
                );
            normalized.Add(name);
        }

        await tagRepo.AddAsync(tenantId, entryId, normalized.Distinct().ToList(), ct);
        await TenantCacheKeys.EvictTagData(cache, tenantId);

        return await tagRepo.GetByEntryIdAsync(tenantId, entryId, ct);
    }

    public async Task<ErrorOr<Success>> RemoveEntryTagAsync(
        Guid tenantId,
        Guid entryId,
        string tagName,
        CancellationToken ct
    )
    {
        var entry = await entryRepo.GetByIdAsync(tenantId, entryId, ct);
        if (entry is null)
            return DomainErrors.EntryNotFound;

        await tagRepo.RemoveAsync(tenantId, entryId, tagName.Trim().ToLowerInvariant(), ct);
        await TenantCacheKeys.EvictTagData(cache, tenantId);

        return Result.Success;
    }
}
