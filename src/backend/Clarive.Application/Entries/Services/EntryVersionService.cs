using Clarive.Application.Entries.Contracts;
using Clarive.Application.Tabs.Contracts;
using Clarive.Domain.Entities;
using Clarive.Domain.Enums;
using Clarive.Domain.Errors;
using Clarive.Domain.Interfaces.Repositories;
using Clarive.Domain.Interfaces.Services;
using Clarive.Domain.ValueObjects;
using Clarive.Infrastructure.Cache;
using ErrorOr;

namespace Clarive.Application.Entries.Services;

public class EntryVersionService(
    IEntryRepository entryRepo,
    IUserRepository userRepo,
    IUnitOfWork unitOfWork,
    ITenantCacheService cache
) : IEntryVersionService
{
    public async Task<
        ErrorOr<(PromptEntry Entry, PromptEntryVersion PublishedVersion)>
    > PublishTabAsync(Guid tenantId, Guid entryId, Guid tabId, Guid userId, CancellationToken ct)
    {
        var entry = await entryRepo.GetByIdAsync(tenantId, entryId, ct);
        if (entry is null)
            return DomainErrors.EntryNotFound;

        var tab = await entryRepo.GetVersionByIdAsync(tenantId, tabId, ct);
        if (tab is null || tab.EntryId != entryId || tab.VersionState != VersionState.Tab)
            return DomainErrors.TabNotFound;

        return await unitOfWork.ExecuteInTransactionAsync(
            async () =>
            {
                var now = DateTime.UtcNow;
                var maxVersion = await entryRepo.GetMaxVersionNumberAsync(tenantId, entryId, ct);

                // Archive current published version
                var currentPublished = await entryRepo.GetPublishedVersionAsync(
                    tenantId, entryId, ct);
                if (currentPublished is not null)
                {
                    currentPublished.VersionState = VersionState.Historical;
                    await entryRepo.UpdateVersionAsync(currentPublished, ct);
                }

                // Create a snapshot of the tab's content as a new published version
                var snapshotId = Guid.NewGuid();
                var snapshot = new PromptEntryVersion
                {
                    Id = snapshotId,
                    EntryId = entryId,
                    Version = maxVersion + 1,
                    VersionState = VersionState.Published,
                    SystemMessage = tab.SystemMessage,
                    Prompts = Common.PromptCloner.ClonePrompts(tab.Prompts, snapshotId),
                    PublishedAt = now,
                    PublishedBy = userId,
                    CreatedAt = now,
                };
                await entryRepo.CreateVersionAsync(snapshot, ct);

                entry.UpdatedAt = now;
                await entryRepo.UpdateAsync(entry, ct);

                await TenantCacheKeys.EvictEntryData(cache, tenantId);
                await TenantCacheKeys.EvictPublishedEntryIds(cache, tenantId);

                return (entry, snapshot);
            },
            ct
        );
    }

    public async Task<
        ErrorOr<(PromptEntry Entry, PromptEntryVersion RestoredTab)>
    > RestoreVersionAsync(Guid tenantId, Guid entryId, int version, Guid? targetTabId, CancellationToken ct)
    {
        var entry = await entryRepo.GetByIdAsync(tenantId, entryId, ct);
        if (entry is null)
            return DomainErrors.EntryNotFound;

        var historical = await entryRepo.GetVersionAsync(tenantId, entryId, version, ct);
        if (historical is null || historical.VersionState != VersionState.Historical)
            return DomainErrors.HistoricalVersionNotFound;

        return await unitOfWork.ExecuteInTransactionAsync(
            async () =>
            {
                var now = DateTime.UtcNow;

                if (targetTabId.HasValue)
                {
                    // Load content into an existing tab
                    var targetTab = await entryRepo.GetVersionByIdAsync(tenantId, targetTabId.Value, ct);
                    if (targetTab is null || targetTab.EntryId != entryId || targetTab.VersionState != VersionState.Tab)
                        return (ErrorOr<(PromptEntry, PromptEntryVersion)>)DomainErrors.TabNotFound;

                    targetTab.SystemMessage = historical.SystemMessage;
                    targetTab.ForkedFromVersion = version;
                    await entryRepo.ReplacePromptsAsync(
                        targetTab,
                        Common.PromptCloner.ClonePrompts(historical.Prompts, targetTab.Id),
                        ct
                    );
                    await entryRepo.UpdateVersionAsync(targetTab, ct);

                    entry.UpdatedAt = now;
                    await entryRepo.UpdateAsync(entry, ct);

                    return (entry, targetTab);
                }
                else
                {
                    // Create a new tab with the historical content
                    var newTabId = Guid.NewGuid();
                    var newTab = await entryRepo.CreateVersionAsync(
                        new PromptEntryVersion
                        {
                            Id = newTabId,
                            EntryId = entryId,
                            Version = 0,
                            VersionState = VersionState.Tab,
                            TabName = $"Restored v{version}",
                            ForkedFromVersion = version,
                            IsMainTab = false,
                            SystemMessage = historical.SystemMessage,
                            Prompts = Common.PromptCloner.ClonePrompts(historical.Prompts, newTabId),
                            CreatedAt = now,
                        },
                        ct
                    );

                    entry.UpdatedAt = now;
                    await entryRepo.UpdateAsync(entry, ct);

                    return (entry, newTab);
                }
            },
            ct
        );
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

        // Tabs first (sorted by CreatedAt DESC), then published/historical (sorted by Version DESC)
        var sorted = versions
            .Where(v => v.VersionState == VersionState.Tab)
            .OrderByDescending(v => v.CreatedAt)
            .Concat(versions
                .Where(v => v.VersionState != VersionState.Tab)
                .OrderByDescending(v => v.Version));

        var versionInfos = sorted
            .Select(v => new VersionInfo(
                v.Id,
                v.Version,
                v.VersionState.ToString().ToLower(),
                v.PublishedAt,
                v.PublishedBy.HasValue && publisherMap.TryGetValue(v.PublishedBy.Value, out var pub)
                    ? pub.Name
                    : null,
                v.TabName,
                v.ForkedFromVersion,
                v.IsMainTab,
                v.Evaluation != null ? new VersionEvaluationInfo(v.Evaluation) : null,
                v.EvaluationAverageScore,
                v.EvaluatedAt
            ))
            .ToList();

        return versionInfos;
    }
}
