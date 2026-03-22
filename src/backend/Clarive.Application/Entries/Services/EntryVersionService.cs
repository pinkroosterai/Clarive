using Clarive.Application.Entries.Contracts;
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
    > PublishDraftAsync(Guid tenantId, Guid entryId, Guid userId, CancellationToken ct)
    {
        var entry = await entryRepo.GetByIdAsync(tenantId, entryId, ct);
        if (entry is null)
            return DomainErrors.EntryNotFound;

        var draft = await entryRepo.GetWorkingVersionAsync(tenantId, entryId, ct);
        if (draft is null || draft.VersionState != VersionState.Draft)
            return Error.Conflict("NO_DRAFT", "No draft version to publish.");

        return await unitOfWork.ExecuteInTransactionAsync(
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

        return await unitOfWork.ExecuteInTransactionAsync(
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

        return await unitOfWork.ExecuteInTransactionAsync(
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
                    : null,
                v.Evaluation != null ? new VersionEvaluationInfo(v.Evaluation) : null,
                v.EvaluationAverageScore,
                v.EvaluatedAt
            ))
            .ToList();

        return versionInfos;
    }
}
