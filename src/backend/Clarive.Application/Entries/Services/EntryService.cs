using Clarive.Domain.Interfaces.Services;
using Clarive.Infrastructure.Cache;
using Microsoft.EntityFrameworkCore;
using System.Text.Json;
using Clarive.Domain.Errors;
using Clarive.Domain.Entities;
using Clarive.Domain.Enums;
using Clarive.Domain.ValueObjects;
using Clarive.Domain.Interfaces.Repositories;
using ErrorOr;
using Microsoft.Extensions.Logging;

namespace Clarive.Application.Entries.Services;

public class EntryService(
    IEntryRepository entryRepo,
    IFolderRepository folderRepo,
    ITagRepository tagRepo,
    IFavoriteRepository favoriteRepo,
    IUserRepository userRepo,
    ITenantCacheService cache,
    IUnitOfWork unitOfWork,
    ILogger<EntryService> logger
) : IEntryService
{
    public async Task<ErrorOr<(PromptEntry Entry, PromptEntryVersion Version)>> CreateEntryAsync(
        Guid tenantId,
        Guid userId,
        CreateEntryRequest request,
        CancellationToken ct
    )
    {
        if (
            request.FolderId is not null
            && await folderRepo.GetByIdAsync(tenantId, request.FolderId.Value, ct) is null
        )
            return DomainErrors.FolderNotFound;

        return await unitOfWork.ExecuteInTransactionAsync(
            async () =>
            {
                var now = DateTime.UtcNow;
                var entry = await entryRepo.CreateAsync(
                    new PromptEntry
                    {
                        Id = Guid.NewGuid(),
                        TenantId = tenantId,
                        Title = request.Title.Trim(),
                        FolderId = request.FolderId,
                        IsTrashed = false,
                        CreatedBy = userId,
                        CreatedAt = now,
                        UpdatedAt = now,
                    },
                    ct
                );

                var prompts = BuildPrompts(request.Prompts);
                var version = await entryRepo.CreateVersionAsync(
                    new PromptEntryVersion
                    {
                        Id = Guid.NewGuid(),
                        EntryId = entry.Id,
                        Version = 0,
                        VersionState = VersionState.Tab,
                        TabName = "Main",
                        IsMainTab = true,
                        SystemMessage = request.SystemMessage,
                        Prompts = prompts,
                        CreatedAt = now,
                    },
                    ct
                );

                await TenantCacheKeys.EvictEntryData(cache, tenantId);

                logger.LogInformation("Entry created: {EntryId} '{Title}' in tenant {TenantId}", entry.Id, entry.Title, tenantId);
                return ((PromptEntry Entry, PromptEntryVersion Version))(entry, version);
            },
            ct
        );
    }

    public async Task<
        ErrorOr<(PromptEntry Entry, PromptEntryVersion WorkingVersion)>
    > UpdateEntryAsync(
        Guid tenantId,
        Guid entryId,
        UpdateEntryRequest request,
        CancellationToken ct
    )
    {
        var entry = await entryRepo.GetByIdAsync(tenantId, entryId, ct);
        if (entry is null)
            return DomainErrors.EntryNotFound;

        // Load the specified tab (or fall back to Main tab)
        var tab = request.TabId.HasValue
            ? await entryRepo.GetVersionByIdAsync(tenantId, request.TabId.Value, ct)
            : await entryRepo.GetMainTabAsync(tenantId, entryId, ct);
        if (tab is null || tab.VersionState != VersionState.Tab)
            return DomainErrors.VersionNotFound;

        // Concurrency conflict detection at two levels:
        // 1. Tab-level: catches same-tab content conflicts (systemMessage, prompts).
        //    Different-tab saves have independent tab xmin values → no false conflicts.
        if (request.TabRowVersion.HasValue && tab.RowVersion != request.TabRowVersion.Value)
            throw new DbUpdateConcurrencyException(
                "The tab was modified by another user since you loaded it.");
        // 2. Entry-level: catches title/metadata conflicts.
        //    Only checked when entry.xmin actually changed AND the title differs
        //    (tab-only saves don't modify the entry row → entry.xmin unchanged).
        if (request.RowVersion.HasValue && entry.RowVersion != request.RowVersion.Value)
            throw new DbUpdateConcurrencyException(
                "The entry was modified by another user since you loaded it.");

        return await unitOfWork.ExecuteInTransactionAsync(
            async () =>
            {
                var now = DateTime.UtcNow;
                var entryModified = false;

                if (request.Title is not null && request.Title.Trim() != entry.Title)
                {
                    entry.Title = request.Title.Trim();
                    entryModified = true;
                }
                if (request.SystemMessage is not null)
                    tab.SystemMessage = request.SystemMessage;
                if (request.Prompts is not null)
                    await entryRepo.ReplacePromptsAsync(
                        tab,
                        BuildPrompts(request.Prompts),
                        ct
                    );
                if (request.Evaluation is not null)
                    MapEvaluationToVersion(tab, request.Evaluation);

                // Only update the entry row when entry-level fields changed,
                // so tab-only saves don't bump entry.xmin (preventing false conflicts)
                if (entryModified)
                {
                    entry.UpdatedAt = now;
                    await entryRepo.UpdateAsync(entry, ct);
                }
                await entryRepo.UpdateVersionAsync(tab, ct);

                return (entry, tab);
            },
            ct
        );
    }


    public async Task<ErrorOr<PromptEntry>> MoveEntryAsync(
        Guid tenantId,
        Guid entryId,
        Guid? folderId,
        CancellationToken ct
    )
    {
        var entry = await entryRepo.GetByIdAsync(tenantId, entryId, ct);
        if (entry is null)
            return DomainErrors.EntryNotFound;

        if (
            folderId is not null
            && await folderRepo.GetByIdAsync(tenantId, folderId.Value, ct) is null
        )
            return DomainErrors.TargetFolderNotFound;

        return await unitOfWork.ExecuteInTransactionAsync(
            async () =>
            {
                entry.FolderId = folderId;
                entry.UpdatedAt = DateTime.UtcNow;
                await entryRepo.UpdateAsync(entry, ct);

                return entry;
            },
            ct
        );
    }

    public async Task<ErrorOr<PromptEntry>> TrashEntryAsync(
        Guid tenantId,
        Guid entryId,
        CancellationToken ct
    )
    {
        var entry = await entryRepo.GetByIdAsync(tenantId, entryId, ct);
        if (entry is null)
            return DomainErrors.EntryNotFound;

        return await unitOfWork.ExecuteInTransactionAsync(
            async () =>
            {
                entry.IsTrashed = true;
                entry.UpdatedAt = DateTime.UtcNow;
                await entryRepo.UpdateAsync(entry, ct);

                await TenantCacheKeys.EvictEntryData(cache, tenantId);

                logger.LogInformation("Entry trashed: {EntryId} in tenant {TenantId}", entryId, tenantId);
                return entry;
            },
            ct
        );
    }

    public async Task<ErrorOr<PromptEntry>> RestoreEntryAsync(
        Guid tenantId,
        Guid entryId,
        CancellationToken ct
    )
    {
        var entry = await entryRepo.GetByIdAsync(tenantId, entryId, ct);
        if (entry is null)
            return DomainErrors.EntryNotFound;

        if (!entry.IsTrashed)
            return Error.Conflict("NOT_TRASHED", "Entry is not in trash.");

        return await unitOfWork.ExecuteInTransactionAsync(
            async () =>
            {
                entry.IsTrashed = false;
                entry.UpdatedAt = DateTime.UtcNow;
                await entryRepo.UpdateAsync(entry, ct);

                await TenantCacheKeys.EvictEntryData(cache, tenantId);

                logger.LogInformation("Entry restored: {EntryId} in tenant {TenantId}", entryId, tenantId);
                return entry;
            },
            ct
        );
    }

    public async Task<ErrorOr<PromptEntry>> DeleteEntryPermanentlyAsync(
        Guid tenantId,
        Guid entryId,
        CancellationToken ct
    )
    {
        var entry = await entryRepo.GetByIdAsync(tenantId, entryId, ct);
        if (entry is null)
            return DomainErrors.EntryNotFound;

        if (!entry.IsTrashed)
            return Error.Conflict(
                "NOT_TRASHED",
                "Entry must be trashed before permanent deletion."
            );

        await unitOfWork.ExecuteInTransactionAsync(
            async () =>
            {
                await entryRepo.DeleteAsync(tenantId, entryId, ct);
            },
            ct
        );

        await TenantCacheKeys.EvictEntryData(cache, tenantId);
        await TenantCacheKeys.EvictPublishedEntryIds(cache, tenantId);

        logger.LogWarning("Entry permanently deleted: {EntryId} in tenant {TenantId}", entryId, tenantId);
        return entry;
    }

    public async Task<
        ErrorOr<(PromptEntry Entry, PromptEntryVersion PublishedVersion)>
    > GetPublishedEntryAsync(Guid tenantId, Guid entryId, CancellationToken ct)
    {
        var entry = await entryRepo.GetByIdAsync(tenantId, entryId, ct);
        if (entry is null || entry.IsTrashed)
            return DomainErrors.EntryNotFound;

        var published = await entryRepo.GetPublishedVersionAsync(tenantId, entryId, ct);
        if (published is null)
            return DomainErrors.NoPublishedVersion;

        return (entry, published);
    }

    // ── List/read operations ──

    public async Task<
        ErrorOr<(List<PromptEntryDto> Summaries, int TotalCount)>
    > ListEntriesAsync(
        Guid tenantId,
        Guid userId,
        Guid? folderId,
        bool includeAll,
        string? tags,
        string? tagMode,
        int page,
        int pageSize,
        string? search,
        string? status,
        string? sortBy,
        CancellationToken ct
    )
    {
        IQueryable<Guid>? filteredEntryIds = null;
        if (!string.IsNullOrWhiteSpace(tags))
        {
            var tagList = tags.Split(
                    ',',
                    StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries
                )
                .Select(t => t.ToLowerInvariant())
                .Distinct()
                .ToList();

            if (tagList.Count > 0)
            {
                var matchAll = string.Equals(tagMode, "and", StringComparison.OrdinalIgnoreCase);
                filteredEntryIds = tagRepo.GetEntryIdsByTagsQuery(tenantId, tagList, matchAll);
            }
        }

        var (entries, totalCount) = await entryRepo.GetByFolderAsync(
            tenantId,
            folderId,
            includeAll,
            new EntryQueryOptions(
                Page: page,
                PageSize: pageSize,
                Search: search,
                Status: status,
                SortBy: sortBy,
                FilteredEntryIds: filteredEntryIds
            ),
            ct
        );
        var summaries = await BuildSummariesBatchAsync(entries, tenantId, userId, ct);
        return (summaries, totalCount);
    }

    public async Task<
        ErrorOr<(List<PromptEntryDto> Summaries, int TotalCount)>
    > ListTrashedEntriesAsync(
        Guid tenantId,
        Guid userId,
        int page,
        int pageSize,
        CancellationToken ct
    )
    {
        var (entries, totalCount) = await entryRepo.GetTrashedAsync(tenantId, page, pageSize, ct);
        var summaries = await BuildSummariesBatchAsync(entries, tenantId, userId, ct);
        return (summaries, totalCount);
    }

    public async Task<ErrorOr<object>> GetEntryDetailAsync(
        Guid tenantId,
        Guid userId,
        Guid entryId,
        CancellationToken ct
    )
    {
        var entry = await entryRepo.GetByIdAsync(tenantId, entryId, ct);
        if (entry is null)
            return DomainErrors.EntryNotFound;

        // Prefer Main tab; fall back to published version (for entries without tabs, e.g. seed data)
        var version = await entryRepo.GetMainTabAsync(tenantId, entryId, ct)
                      ?? await entryRepo.GetPublishedVersionAsync(tenantId, entryId, ct);
        if (version is null)
            return DomainErrors.VersionNotFound;

        var isFavorited = await favoriteRepo.ExistsAsync(tenantId, userId, entryId, ct);
        return await BuildFullResponseAsync(entry, version, tenantId, isFavorited, ct);
    }

    public async Task<ErrorOr<object>> GetVersionDetailAsync(
        Guid tenantId,
        Guid entryId,
        int version,
        CancellationToken ct
    )
    {
        var entry = await entryRepo.GetByIdAsync(tenantId, entryId, ct);
        if (entry is null)
            return DomainErrors.EntryNotFound;

        var ver = await entryRepo.GetVersionAsync(tenantId, entryId, version, ct);
        if (ver is null)
            return DomainErrors.VersionNotFound;

        return await BuildFullResponseAsync(entry, ver, tenantId, false, ct);
    }

    public async Task<ErrorOr<object>> BuildEntryResponseAsync(
        PromptEntry entry,
        PromptEntryVersion version,
        Guid tenantId,
        bool isFavorited,
        CancellationToken ct
    )
    {
        return await BuildFullResponseAsync(entry, version, tenantId, isFavorited, ct);
    }

    public async Task<ErrorOr<PromptEntryVersion>> GetMainTabVersionAsync(
        Guid tenantId,
        Guid entryId,
        CancellationToken ct
    )
    {
        var version = await entryRepo.GetMainTabAsync(tenantId, entryId, ct)
                      ?? await entryRepo.GetPublishedVersionAsync(tenantId, entryId, ct);
        if (version is null)
            return DomainErrors.VersionNotFound;
        return version;
    }

    private async Task<List<PromptEntryDto>> BuildSummariesBatchAsync(
        List<PromptEntry> entries,
        Guid tenantId,
        Guid userId,
        CancellationToken ct
    )
    {
        var entryIds = entries.Select(e => e.Id).ToList();
        var workingVersions = await entryRepo.GetMainTabsBatchAsync(tenantId, entryIds, ct);
        var publishedVersions = await entryRepo.GetPublishedVersionsBatchAsync(tenantId, entryIds, ct);
        var tagsByEntry = await tagRepo.GetByEntryIdsBatchAsync(tenantId, entryIds, ct);
        var favoritedIds = await favoriteRepo.GetFavoritedEntryIdsAsync(
            tenantId,
            userId,
            entryIds,
            ct
        );

        return entries
            .Select(entry =>
            {
                workingVersions.TryGetValue(entry.Id, out var version);
                tagsByEntry.TryGetValue(entry.Id, out var entryTags);
                publishedVersions.TryGetValue(entry.Id, out var publishedVersion);
                return PromptEntryDto.FromEntryAndVersion(
                    entry,
                    version,
                    entryTags,
                    favoritedIds.Contains(entry.Id),
                    hasPublished: publishedVersion is not null,
                    publishedEvaluationScore: publishedVersion?.EvaluationAverageScore
                );
            })
            .ToList();
    }

    private async Task<object> BuildFullResponseAsync(
        PromptEntry entry,
        PromptEntryVersion version,
        Guid tenantId,
        bool isFavorited,
        CancellationToken ct
    )
    {
        var userIds = new HashSet<Guid> { entry.CreatedBy };
        if (version.PublishedBy.HasValue)
            userIds.Add(version.PublishedBy.Value);
        var users = await userRepo.GetByIdsAsync(tenantId, userIds, ct);

        var creatorName = users.TryGetValue(entry.CreatedBy, out var creator) ? creator.Name : null;
        var publisherName =
            version.PublishedBy.HasValue
            && users.TryGetValue(version.PublishedBy.Value, out var publisher)
                ? publisher.Name
                : null;

        return new
        {
            entry.Id,
            entry.Title,
            version.SystemMessage,
            Prompts = version
                .Prompts.OrderBy(p => p.Order)
                .Select(p => new
                {
                    p.Id,
                    p.Content,
                    p.Order,
                    p.IsTemplate,
                    TemplateFields = p.TemplateFields.Select(tf => new
                    {
                        tf.Id,
                        tf.Name,
                        tf.Type,
                        tf.EnumValues,
                        tf.DefaultValue,
                        tf.Min,
                        tf.Max,
                    }),
                }),
            entry.FolderId,
            version.Version,
            VersionState = version.VersionState.ToString().ToLower(),
            entry.IsTrashed,
            entry.CreatedAt,
            entry.UpdatedAt,
            CreatedBy = creatorName ?? entry.CreatedBy.ToString(),
            version.PublishedAt,
            PublishedBy = publisherName,
            IsFavorited = isFavorited,
            Evaluation = version.Evaluation != null
                ? new { Dimensions = version.Evaluation }
                : null,
            version.EvaluationAverageScore,
            version.EvaluatedAt,
            RowVersion = entry.RowVersion,
            TabRowVersion = version.RowVersion,
        };
    }

    private static void MapEvaluationToVersion(
        PromptEntryVersion version,
        Dictionary<string, PromptEvaluationEntry> evaluation)
    {
        version.Evaluation = evaluation.ToDictionary(
            kvp => kvp.Key,
            kvp => new PromptEvaluationEntry
            {
                Score = Math.Clamp(kvp.Value.Score, 0, 10),
                Feedback = kvp.Value.Feedback,
            }
        );
        version.EvaluationAverageScore = evaluation.Count > 0
            ? evaluation.Values.Average(e => e.Score)
            : null;
        version.EvaluatedAt = DateTime.UtcNow;
    }

    private static List<Prompt> BuildPrompts(List<PromptInput> inputs)
    {
        return inputs
            .Select(
                (pi, i) =>
                {
                    var fields = TemplateParser.Parse(pi.Content);
                    var isTemplate = pi.IsTemplate || fields.Count > 0;
                    return new Prompt
                    {
                        Id = Guid.NewGuid(),
                        Content = pi.Content,
                        Order = i,
                        IsTemplate = isTemplate,
                        TemplateFields = isTemplate ? fields : [],
                    };
                }
            )
            .ToList();
    }
}
