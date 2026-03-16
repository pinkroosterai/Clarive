using Clarive.Api.Helpers;
using Clarive.Api.Models.Entities;
using Clarive.Api.Models.Responses;
using Clarive.Api.Repositories.Interfaces;

namespace Clarive.Api.Endpoints;

public static partial class EntryEndpoints
{
    private static async Task<List<PromptEntrySummary>> BuildSummariesBatchAsync(
        List<PromptEntry> entries,
        IEntryRepository entryRepo,
        ITagRepository tagRepo,
        IFavoriteRepository favoriteRepo,
        Guid tenantId,
        Guid userId,
        CancellationToken ct)
    {
        var entryIds = entries.Select(e => e.Id).ToList();
        var workingVersions = await entryRepo.GetWorkingVersionsBatchAsync(tenantId, entryIds, ct);
        var tagsByEntry = await tagRepo.GetByEntryIdsBatchAsync(tenantId, entryIds, ct);
        var favoritedIds = await favoriteRepo.GetFavoritedEntryIdsAsync(tenantId, userId, entryIds, ct);

        return entries.Select(entry =>
        {
            workingVersions.TryGetValue(entry.Id, out var version);
            tagsByEntry.TryGetValue(entry.Id, out var tags);
            return PromptEntrySummary.FromEntryAndVersion(entry, version, tags, favoritedIds.Contains(entry.Id));
        }).ToList();
    }

    private static async Task<object> BuildFullResponseAsync(
        PromptEntry entry,
        PromptEntryVersion version,
        IUserRepository userRepo,
        Guid tenantId,
        CancellationToken ct,
        bool? isFavorited = null)
    {
        var userIds = new HashSet<Guid> { entry.CreatedBy };
        if (version.PublishedBy.HasValue) userIds.Add(version.PublishedBy.Value);
        var users = await userRepo.GetByIdsAsync(tenantId, userIds, ct);

        var creatorName = users.TryGetValue(entry.CreatedBy, out var creator) ? creator.Name : null;
        var publisherName = version.PublishedBy.HasValue && users.TryGetValue(version.PublishedBy.Value, out var publisher)
            ? publisher.Name : null;

        return new
        {
            entry.Id,
            entry.Title,
            version.SystemMessage,
            Prompts = version.Prompts.OrderBy(p => p.Order).Select(p => new
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
                    tf.Max
                })
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
            IsFavorited = isFavorited ?? false
        };
    }

    private static async Task<(PromptEntryVersion? version, IResult? error)> GetWorkingVersionOrError(
        HttpContext ctx, IEntryRepository entryRepo, Guid tenantId, Guid entryId, CancellationToken ct)
    {
        var version = await entryRepo.GetWorkingVersionAsync(tenantId, entryId, ct);
        if (version is null)
            return (null, ctx.ErrorResult(404, "NOT_FOUND", "No version found for this entry.", "Entry", entryId.ToString()));
        return (version, null);
    }
}
