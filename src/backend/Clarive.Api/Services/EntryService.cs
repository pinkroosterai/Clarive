using System.Text.Json;
using System.Text.RegularExpressions;
using Clarive.Api.Data;
using Clarive.Api.Helpers;
using Clarive.Api.Models.Entities;
using Clarive.Api.Models.Enums;
using Clarive.Api.Models.Requests;
using Clarive.Api.Models.Responses;
using Clarive.Api.Repositories.Interfaces;
using Clarive.Api.Services.Interfaces;
using ErrorOr;

namespace Clarive.Api.Services;

public partial class EntryService(
    IEntryRepository entryRepo,
    IFolderRepository folderRepo,
    ITagRepository tagRepo,
    IFavoriteRepository favoriteRepo,
    IUserRepository userRepo,
    IAuditLogRepository auditRepo,
    TenantCacheService cache,
    ClariveDbContext db
) : IEntryService
{
    private const int MaxPromptContentLength = 100_000;

    public async Task<ErrorOr<(PromptEntry Entry, PromptEntryVersion Version)>> CreateEntryAsync(
        Guid tenantId,
        Guid userId,
        CreateEntryRequest request,
        CancellationToken ct
    )
    {
        if (ValidatePromptContentLength(request.Prompts) is { } contentErr)
            return contentErr;

        if (
            request.FolderId is not null
            && await folderRepo.GetByIdAsync(tenantId, request.FolderId.Value, ct) is null
        )
            return DomainErrors.FolderNotFound;

        return await db.Database.InTransactionAsync(
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
                        Version = 1,
                        VersionState = VersionState.Draft,
                        SystemMessage = request.SystemMessage,
                        Prompts = prompts,
                        CreatedAt = now,
                    },
                    ct
                );

                await TenantCacheKeys.EvictEntryData(cache, tenantId);

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
        if (
            request.Prompts is not null
            && ValidatePromptContentLength(request.Prompts) is { } contentErr
        )
            return contentErr;

        var entry = await entryRepo.GetByIdAsync(tenantId, entryId, ct);
        if (entry is null)
            return DomainErrors.EntryNotFound;

        var working = await entryRepo.GetWorkingVersionAsync(tenantId, entryId, ct);
        if (working is null)
            return DomainErrors.VersionNotFound;

        return await db.Database.InTransactionAsync(
            async () =>
            {
                var now = DateTime.UtcNow;

                if (working.VersionState == VersionState.Draft)
                {
                    if (request.Title is not null)
                        entry.Title = request.Title.Trim();
                    if (request.SystemMessage is not null)
                        working.SystemMessage = request.SystemMessage;
                    if (request.Prompts is not null)
                        await entryRepo.ReplacePromptsAsync(
                            working,
                            BuildPrompts(request.Prompts),
                            ct
                        );

                    entry.UpdatedAt = now;
                    await entryRepo.UpdateAsync(entry, ct);
                    await entryRepo.UpdateVersionAsync(working, ct);
                }
                else
                {
                    var maxVersion = await entryRepo.GetMaxVersionNumberAsync(
                        tenantId,
                        entryId,
                        ct
                    );
                    if (request.Title is not null)
                        entry.Title = request.Title.Trim();
                    entry.UpdatedAt = now;
                    await entryRepo.UpdateAsync(entry, ct);

                    working = await entryRepo.CreateVersionAsync(
                        new PromptEntryVersion
                        {
                            Id = Guid.NewGuid(),
                            EntryId = entryId,
                            Version = maxVersion + 1,
                            VersionState = VersionState.Draft,
                            SystemMessage = request.SystemMessage ?? working.SystemMessage,
                            Prompts = request.Prompts is not null
                                ? BuildPrompts(request.Prompts)
                                : working.Prompts,
                            CreatedAt = now,
                        },
                        ct
                    );
                }

                return (entry, working);
            },
            ct
        );
    }

    public async Task<
        ErrorOr<(PromptEntry Entry, PromptEntryVersion PublishedVersion)>
    > PublishDraftAsync(Guid tenantId, Guid entryId, Guid userId, CancellationToken ct)
    {
        var entry = await entryRepo.GetByIdAsync(tenantId, entryId, ct);
        if (entry is null)
            return DomainErrors.EntryNotFound;

        var draft = await entryRepo.GetWorkingVersionAsync(tenantId, entryId, ct);
        if (draft is null || draft.VersionState != VersionState.Draft)
            return Error.Conflict("NO_DRAFT", "No draft version to publish.");

        return await db.Database.InTransactionAsync(
            async () =>
            {
                var now = DateTime.UtcNow;

                var currentPublished = await entryRepo.GetPublishedVersionAsync(
                    tenantId,
                    entryId,
                    ct
                );
                if (currentPublished is not null)
                {
                    currentPublished.VersionState = VersionState.Historical;
                    await entryRepo.UpdateVersionAsync(currentPublished, ct);
                }

                draft.VersionState = VersionState.Published;
                draft.PublishedAt = now;
                draft.PublishedBy = userId;
                await entryRepo.UpdateVersionAsync(draft, ct);

                entry.UpdatedAt = now;
                await entryRepo.UpdateAsync(entry, ct);

                await TenantCacheKeys.EvictEntryData(cache, tenantId);
                await TenantCacheKeys.EvictPublishedEntryIds(cache, tenantId);

                return (entry, draft);
            },
            ct
        );
    }

    public async Task<
        ErrorOr<(PromptEntry Entry, PromptEntryVersion NewDraft)>
    > PromoteVersionAsync(Guid tenantId, Guid entryId, int version, CancellationToken ct)
    {
        var entry = await entryRepo.GetByIdAsync(tenantId, entryId, ct);
        if (entry is null)
            return DomainErrors.EntryNotFound;

        var historical = await entryRepo.GetVersionAsync(tenantId, entryId, version, ct);
        if (historical is null || historical.VersionState != VersionState.Historical)
            return DomainErrors.HistoricalVersionNotFound;

        return await db.Database.InTransactionAsync(
            async () =>
            {
                var now = DateTime.UtcNow;
                var maxVersion = await entryRepo.GetMaxVersionNumberAsync(tenantId, entryId, ct);

                var workingVersion = await entryRepo.GetWorkingVersionAsync(tenantId, entryId, ct);
                if (workingVersion?.VersionState == VersionState.Draft)
                    await entryRepo.DeleteVersionAsync(workingVersion, ct);

                var newDraftId = Guid.NewGuid();
                var clonedPrompts = historical
                    .Prompts.Select(p =>
                    {
                        var newPromptId = Guid.NewGuid();
                        return new Prompt
                        {
                            Id = newPromptId,
                            VersionId = newDraftId,
                            Content = p.Content,
                            Order = p.Order,
                            IsTemplate = p.IsTemplate,
                            TemplateFields = p
                                .TemplateFields.Select(tf => new TemplateField
                                {
                                    Id = Guid.NewGuid(),
                                    PromptId = newPromptId,
                                    Name = tf.Name,
                                    Type = tf.Type,
                                    EnumValues = tf.EnumValues,
                                    DefaultValue = tf.DefaultValue,
                                    Min = tf.Min,
                                    Max = tf.Max,
                                })
                                .ToList(),
                        };
                    })
                    .ToList();

                var newDraft = await entryRepo.CreateVersionAsync(
                    new PromptEntryVersion
                    {
                        Id = newDraftId,
                        EntryId = entryId,
                        Version = maxVersion + 1,
                        VersionState = VersionState.Draft,
                        SystemMessage = historical.SystemMessage,
                        Prompts = clonedPrompts,
                        PublishedAt = null,
                        PublishedBy = null,
                        CreatedAt = now,
                    },
                    ct
                );

                entry.UpdatedAt = now;
                await entryRepo.UpdateAsync(entry, ct);

                return (entry, newDraft);
            },
            ct
        );
    }

    public async Task<ErrorOr<PromptEntry>> DeleteDraftAsync(
        Guid tenantId,
        Guid entryId,
        CancellationToken ct
    )
    {
        var entry = await entryRepo.GetByIdAsync(tenantId, entryId, ct);
        if (entry is null)
            return DomainErrors.EntryNotFound;

        var working = await entryRepo.GetWorkingVersionAsync(tenantId, entryId, ct);
        if (working is null || working.VersionState != VersionState.Draft)
            return Error.Validation("NO_DRAFT", "No draft version exists for this entry.");

        var published = await entryRepo.GetPublishedVersionAsync(tenantId, entryId, ct);
        if (published is null)
            return Error.Validation(
                "NO_PUBLISHED_VERSION",
                "Cannot delete the only version. A published version must exist to fall back to."
            );

        return await db.Database.InTransactionAsync(
            async () =>
            {
                await entryRepo.DeleteVersionAsync(working, ct);

                entry.UpdatedAt = DateTime.UtcNow;
                await entryRepo.UpdateAsync(entry, ct);

                return entry;
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

        return await db.Database.InTransactionAsync(
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

        return await db.Database.InTransactionAsync(
            async () =>
            {
                entry.IsTrashed = true;
                entry.UpdatedAt = DateTime.UtcNow;
                await entryRepo.UpdateAsync(entry, ct);

                await TenantCacheKeys.EvictEntryData(cache, tenantId);

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

        return await db.Database.InTransactionAsync(
            async () =>
            {
                entry.IsTrashed = false;
                entry.UpdatedAt = DateTime.UtcNow;
                await entryRepo.UpdateAsync(entry, ct);

                await TenantCacheKeys.EvictEntryData(cache, tenantId);

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

        await db.Database.InTransactionAsync(
            async () =>
            {
                await entryRepo.DeleteAsync(tenantId, entryId, ct);
            },
            ct
        );

        await TenantCacheKeys.EvictEntryData(cache, tenantId);
        await TenantCacheKeys.EvictPublishedEntryIds(cache, tenantId);

        return entry;
    }

    public async Task<
        ErrorOr<(PromptEntry Entry, PromptEntryVersion PublishedVersion)>
    > GetPublishedEntryAsync(Guid tenantId, Guid entryId, CancellationToken ct)
    {
        var entry = await entryRepo.GetByIdAsync(tenantId, entryId, ct);
        if (entry is null || entry.IsTrashed)
            return DomainErrors.EntryNotFoundByCode;

        var published = await entryRepo.GetPublishedVersionAsync(tenantId, entryId, ct);
        if (published is null)
            return DomainErrors.NoPublishedVersion;

        return (entry, published);
    }

    // ── List/read operations ──

    public async Task<
        ErrorOr<(List<PromptEntrySummary> Summaries, int TotalCount)>
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
        ErrorOr<(List<PromptEntrySummary> Summaries, int TotalCount)>
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

        var version = await entryRepo.GetWorkingVersionAsync(tenantId, entryId, ct);
        if (version is null)
            return DomainErrors.VersionNotFound;

        var isFavorited = await favoriteRepo.ExistsAsync(tenantId, userId, entryId, ct);
        return await BuildFullResponseAsync(entry, version, tenantId, isFavorited, ct);
    }

    public async Task<ErrorOr<List<VersionInfo>>> GetVersionHistoryAsync(
        Guid tenantId,
        Guid entryId,
        CancellationToken ct
    )
    {
        var entry = await entryRepo.GetByIdAsync(tenantId, entryId, ct);
        if (entry is null)
            return DomainErrors.EntryNotFound;

        var versions = await entryRepo.GetVersionHistoryAsync(tenantId, entryId, ct);

        var publisherIds = versions
            .Where(v => v.PublishedBy.HasValue)
            .Select(v => v.PublishedBy!.Value)
            .Distinct();
        var publisherMap = await userRepo.GetByIdsAsync(tenantId, publisherIds, ct);

        var versionInfos = versions
            .Select(v => new VersionInfo(
                v.Version,
                v.VersionState.ToString().ToLower(),
                v.PublishedAt,
                v.PublishedBy.HasValue && publisherMap.TryGetValue(v.PublishedBy.Value, out var pub)
                    ? pub.Name
                    : null
            ))
            .ToList();

        return versionInfos;
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

    public async Task<ErrorOr<PromptEntryVersion>> GetWorkingVersionAsync(
        Guid tenantId,
        Guid entryId,
        CancellationToken ct
    )
    {
        var version = await entryRepo.GetWorkingVersionAsync(tenantId, entryId, ct);
        if (version is null)
            return DomainErrors.VersionNotFound;
        return version;
    }

    private async Task<List<PromptEntrySummary>> BuildSummariesBatchAsync(
        List<PromptEntry> entries,
        Guid tenantId,
        Guid userId,
        CancellationToken ct
    )
    {
        var entryIds = entries.Select(e => e.Id).ToList();
        var workingVersions = await entryRepo.GetWorkingVersionsBatchAsync(tenantId, entryIds, ct);
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
                return PromptEntrySummary.FromEntryAndVersion(
                    entry,
                    version,
                    entryTags,
                    favoritedIds.Contains(entry.Id)
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
        };
    }

    // ── Activity ──

    [GeneratedRegex(@"v(?:ersion\s+)?(\d+)")]
    private static partial Regex VersionPattern();

    public async Task<ErrorOr<EntryActivityResponse>> GetEntryActivityAsync(
        Guid tenantId,
        Guid entryId,
        int page,
        int pageSize,
        CancellationToken ct
    )
    {
        var entry = await entryRepo.GetByIdAsync(tenantId, entryId, ct);
        if (entry is null)
            return DomainErrors.EntryNotFound;

        var (entries, total) = await auditRepo.GetByEntityIdAsync(
            tenantId,
            entryId,
            page,
            pageSize,
            ct
        );

        var items = entries
            .Select(a =>
            {
                int? version = null;
                if (a.Details is not null)
                {
                    var match = VersionPattern().Match(a.Details);
                    if (match.Success && int.TryParse(match.Groups[1].Value, out var v))
                        version = v;
                }

                return new EntryActivityItem(
                    a.Id,
                    JsonNamingPolicy.SnakeCaseLower.ConvertName(a.Action.ToString()),
                    a.UserName,
                    a.Details,
                    version,
                    a.Timestamp
                );
            })
            .ToList();

        return new EntryActivityResponse(items, total, page, pageSize);
    }

    // ── Favorite operations ──

    public async Task<ErrorOr<Success>> FavoriteEntryAsync(
        Guid tenantId,
        Guid userId,
        Guid entryId,
        CancellationToken ct
    )
    {
        var entry = await entryRepo.GetByIdAsync(tenantId, entryId, ct);
        if (entry is null)
            return DomainErrors.EntryNotFound;

        if (await favoriteRepo.ExistsAsync(tenantId, userId, entryId, ct))
            return Result.Success;

        await favoriteRepo.AddAsync(
            new EntryFavorite
            {
                Id = Guid.NewGuid(),
                TenantId = tenantId,
                UserId = userId,
                EntryId = entryId,
                CreatedAt = DateTime.UtcNow,
            },
            ct
        );

        return Result.Success;
    }

    public async Task<ErrorOr<Success>> UnfavoriteEntryAsync(
        Guid tenantId,
        Guid userId,
        Guid entryId,
        CancellationToken ct
    )
    {
        await favoriteRepo.RemoveAsync(tenantId, userId, entryId, ct);
        return Result.Success;
    }

    // ── Tag operations ──

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

    private static Error? ValidatePromptContentLength(List<PromptInput> prompts)
    {
        for (var i = 0; i < prompts.Count; i++)
        {
            if (prompts[i].Content.Length > MaxPromptContentLength)
                return Error.Validation(
                    "VALIDATION_ERROR",
                    $"Prompt #{i + 1} content exceeds maximum length of {MaxPromptContentLength:N0} characters."
                );
        }
        return null;
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
