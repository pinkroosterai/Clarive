using Clarive.Domain.Interfaces.Services;
using Clarive.Infrastructure.Cache;
using Clarive.Domain.Entities;
using Clarive.Domain.Enums;
using Clarive.Domain.ValueObjects;
using Clarive.Domain.Interfaces.Repositories;
using YamlDotNet.Serialization;
using Microsoft.Extensions.Logging;
using YamlDotNet.Serialization.NamingConventions;

namespace Clarive.Application.ImportExport.Services;

public class ImportExportService(
    IEntryRepository entryRepo,
    IFolderRepository folderRepo,
    ITagRepository tagRepo,
    IUnitOfWork unitOfWork,
    ITenantCacheService cache,
    ILogger<ImportExportService> logger
) : IImportExportService
{
    private const int MaxFolderDepth = 20;
    private const int ExportChunkSize = 1000;

    private static readonly ISerializer YamlSerializer = new SerializerBuilder()
        .WithNamingConvention(CamelCaseNamingConvention.Instance)
        .Build();

    public async Task<ExportFileResult> ExportAsync(
        Guid tenantId,
        ExportRequest? request,
        CancellationToken ct
    )
    {
        var entries = await GatherExportEntriesAsync(tenantId, request, ct);
        var exportEntries = await BuildExportEntriesAsync(tenantId, entries, ct);

        var export = new Dictionary<string, object>
        {
            ["version"] = "1.0",
            ["exportedAt"] = DateTime.UtcNow.ToString("O"),
            ["entries"] = exportEntries,
        };

        var yaml = YamlSerializer.Serialize(export);
        var bytes = System.Text.Encoding.UTF8.GetBytes(yaml);
        var fileName = $"clarive-export-{DateTime.UtcNow:yyyy-MM-dd}.yaml";

        logger.LogInformation("Exported {EntryCount} entries for tenant {TenantId}", exportEntries.Count, tenantId);
        return new ExportFileResult(bytes, "application/x-yaml", fileName);
    }

    public async Task<ImportResponse> ImportAsync(
        Guid tenantId,
        Guid userId,
        List<object> entryList,
        CancellationToken ct
    )
    {
        var folderCache = new Dictionary<string, Guid>();
        var createdEntries = new List<PromptEntryDto>();
        var batchEntries = new List<PromptEntry>();
        var batchVersions = new List<PromptEntryVersion>();

        await unitOfWork.ExecuteInTransactionAsync(
            async () =>
            {
                foreach (var item in entryList)
                {
                    if (item is not Dictionary<object, object> raw)
                        continue;

                    var title = raw.TryGetValue("title", out var t)
                        ? t?.ToString() ?? "Untitled"
                        : "Untitled";
                    var systemMessage = raw.TryGetValue("systemMessage", out var sm)
                        ? sm?.ToString()
                        : null;
                    var folderName = raw.TryGetValue("folder", out var fn) ? fn?.ToString() : null;

                    var folderId = await ResolveImportFolderAsync(
                        folderName,
                        tenantId,
                        folderCache,
                        ct
                    );
                    var prompts = ParseImportPrompts(raw);

                    var entry = new PromptEntry
                    {
                        Id = Guid.NewGuid(),
                        TenantId = tenantId,
                        Title = title,
                        FolderId = folderId,
                        IsTrashed = false,
                        CreatedBy = userId,
                        CreatedAt = DateTime.UtcNow,
                        UpdatedAt = DateTime.UtcNow,
                    };
                    batchEntries.Add(entry);

                    var version = new PromptEntryVersion
                    {
                        Id = Guid.NewGuid(),
                        EntryId = entry.Id,
                        Version = 1,
                        VersionState = VersionState.Draft,
                        SystemMessage = systemMessage,
                        Prompts = prompts,
                        CreatedAt = DateTime.UtcNow,
                    };
                    batchVersions.Add(version);

                    createdEntries.Add(PromptEntryDto.FromEntryAndVersion(entry, version));
                }

                await entryRepo.CreateBatchAsync(batchEntries, batchVersions, ct);

                // Import tags
                for (var i = 0; i < batchEntries.Count; i++)
                {
                    if (entryList[i] is not Dictionary<object, object> rawItem)
                        continue;
                    var importTags = ParseImportTags(rawItem);
                    if (importTags.Count > 0)
                        await tagRepo.AddAsync(tenantId, batchEntries[i].Id, importTags, ct);
                }
            },
            ct
        );

        await TenantCacheKeys.EvictFolderData(cache, tenantId);
        await TenantCacheKeys.EvictEntryData(cache, tenantId);
        await TenantCacheKeys.EvictTagData(cache, tenantId);
        await TenantCacheKeys.EvictPublishedEntryIds(cache, tenantId);

        logger.LogInformation("Imported {EntryCount} entries for tenant {TenantId}", createdEntries.Count, tenantId);
        return new ImportResponse(createdEntries.Count, createdEntries);
    }

    // ── Private helpers ──

    private async Task<List<PromptEntry>> GatherExportEntriesAsync(
        Guid tenantId,
        ExportRequest? request,
        CancellationToken ct
    )
    {
        var entries = new List<PromptEntry>();
        var folderIds = request?.FolderIds;
        var entryIds = request?.EntryIds;

        if (entryIds is { Count: > 0 })
        {
            var byId = await entryRepo.GetByIdsAsync(tenantId, entryIds, ct);
            entries.AddRange(byId.Values.Where(e => !e.IsTrashed));
        }
        else if (folderIds is { Count: > 0 })
        {
            var allFolderIds = new HashSet<Guid>(folderIds);
            await ExpandFolderSubtreeAsync(tenantId, folderIds, allFolderIds, ct: ct);

            entries.AddRange(await entryRepo.GetByFolderIdsAsync(tenantId, allFolderIds, ct));
        }
        else
        {
            var page = 1;
            while (true)
            {
                var (chunk, _) = await entryRepo.GetByFolderAsync(
                    tenantId,
                    null,
                    includeAll: true,
                    new EntryQueryOptions(Page: page, PageSize: ExportChunkSize),
                    ct
                );
                entries.AddRange(chunk.Where(e => !e.IsTrashed));
                if (chunk.Count < ExportChunkSize)
                    break;
                page++;
            }
        }

        return entries;
    }

    private async Task<List<Dictionary<string, object>>> BuildExportEntriesAsync(
        Guid tenantId,
        List<PromptEntry> entries,
        CancellationToken ct
    )
    {
        var entryIds = entries.Select(e => e.Id).ToList();
        var publishedVersions = await entryRepo.GetPublishedVersionsBatchAsync(
            tenantId,
            entryIds,
            ct
        );
        var tagsByEntry = await tagRepo.GetByEntryIdsBatchAsync(tenantId, entryIds, ct);

        var folderIdSet = entries
            .Where(e => e.FolderId.HasValue)
            .Select(e => e.FolderId!.Value)
            .Distinct();
        var folders = await folderRepo.GetByIdsAsync(tenantId, folderIdSet, ct);

        var exportEntries = new List<Dictionary<string, object>>();

        foreach (var entry in entries)
        {
            if (!publishedVersions.TryGetValue(entry.Id, out var published))
                continue;

            var prompts = published
                .Prompts.OrderBy(p => p.Order)
                .Select(p => new Dictionary<string, object>
                {
                    ["content"] = p.Content,
                    ["isTemplate"] = p.IsTemplate,
                })
                .ToList();

            var exportEntry = new Dictionary<string, object>
            {
                ["title"] = entry.Title,
                ["version"] = published.Version,
            };

            if (
                entry.FolderId.HasValue && folders.TryGetValue(entry.FolderId.Value, out var folder)
            )
                exportEntry["folder"] = folder.Name;

            if (!string.IsNullOrEmpty(published.SystemMessage))
                exportEntry["systemMessage"] = published.SystemMessage;

            exportEntry["prompts"] = prompts;

            if (tagsByEntry.TryGetValue(entry.Id, out var entryTags) && entryTags.Count > 0)
                exportEntry["tags"] = entryTags;

            exportEntries.Add(exportEntry);
        }

        return exportEntries;
    }

    private async Task ExpandFolderSubtreeAsync(
        Guid tenantId,
        List<Guid> parentIds,
        HashSet<Guid> collected,
        int depth = 0,
        CancellationToken ct = default
    )
    {
        if (depth >= MaxFolderDepth)
            return;

        var tasks = parentIds.Select(pid => folderRepo.GetChildrenAsync(tenantId, pid, ct));
        var childrenLists = await Task.WhenAll(tasks);
        var allChildIds = childrenLists
            .SelectMany(c => c.Select(f => f.Id))
            .Where(collected.Add)
            .ToList();
        if (allChildIds.Count > 0)
            await ExpandFolderSubtreeAsync(tenantId, allChildIds, collected, depth + 1, ct);
    }

    private async Task<Guid?> ResolveImportFolderAsync(
        string? folderName,
        Guid tenantId,
        Dictionary<string, Guid> folderCache,
        CancellationToken ct
    )
    {
        if (string.IsNullOrEmpty(folderName))
            return null;

        if (folderCache.TryGetValue(folderName, out var cachedFolderId))
            return cachedFolderId;

        var folder = await folderRepo.CreateAsync(
            new Folder
            {
                Id = Guid.NewGuid(),
                TenantId = tenantId,
                Name = folderName,
                ParentId = null,
                CreatedAt = DateTime.UtcNow,
            },
            ct
        );

        folderCache[folderName] = folder.Id;
        return folder.Id;
    }

    private static List<string> ParseImportTags(Dictionary<object, object> raw)
    {
        if (!raw.TryGetValue("tags", out var tagsObj) || tagsObj is not List<object> tagList)
            return [];

        return tagList
            .Select(t => t?.ToString()?.Trim().ToLowerInvariant())
            .Where(t => !string.IsNullOrEmpty(t) && t.Length <= 50)
            .Distinct()
            .ToList()!;
    }

    private static List<Prompt> ParseImportPrompts(Dictionary<object, object> raw)
    {
        var prompts = new List<Prompt>();
        if (
            !raw.TryGetValue("prompts", out var promptsObj)
            || promptsObj is not List<object> promptList
        )
            return prompts;

        for (var i = 0; i < promptList.Count; i++)
        {
            if (promptList[i] is not Dictionary<object, object> pRaw)
                continue;
            var content = pRaw.TryGetValue("content", out var c) ? c?.ToString() ?? "" : "";
            var isTemplate =
                pRaw.TryGetValue("isTemplate", out var it)
                && bool.TryParse(it?.ToString(), out var itVal)
                && itVal;
            var templateFields = isTemplate ? TemplateParser.Parse(content) : [];
            prompts.Add(
                new Prompt
                {
                    Id = Guid.NewGuid(),
                    Content = content,
                    Order = i,
                    IsTemplate = isTemplate,
                    TemplateFields = templateFields,
                }
            );
        }

        return prompts;
    }
}
