using Clarive.Api.Data;
using Clarive.Api.Helpers;
using Clarive.Api.Models.Entities;
using Clarive.Api.Models.Enums;
using Clarive.Api.Models.Requests;
using Clarive.Api.Repositories.Interfaces;
using Clarive.Api.Services.Interfaces;
using ErrorOr;

namespace Clarive.Api.Services;

public class EntryService(
    IEntryRepository entryRepo,
    IFolderRepository folderRepo,
    ClariveDbContext db) : IEntryService
{
    private const int MaxPromptContentLength = 100_000;

    public async Task<ErrorOr<(PromptEntry Entry, PromptEntryVersion Version)>> CreateEntryAsync(
        Guid tenantId, Guid userId, CreateEntryRequest request, CancellationToken ct)
    {
        if (request.FolderId is not null && await folderRepo.GetByIdAsync(tenantId, request.FolderId.Value, ct) is null)
            return DomainErrors.FolderNotFound;

        return await db.Database.InTransactionAsync(async () =>
        {
            var now = DateTime.UtcNow;
            var entry = await entryRepo.CreateAsync(new PromptEntry
            {
                Id = Guid.NewGuid(),
                TenantId = tenantId,
                Title = request.Title.Trim(),
                FolderId = request.FolderId,
                IsTrashed = false,
                CreatedBy = userId,
                CreatedAt = now,
                UpdatedAt = now
            }, ct);

            var prompts = BuildPrompts(request.Prompts);
            var version = await entryRepo.CreateVersionAsync(new PromptEntryVersion
            {
                Id = Guid.NewGuid(),
                EntryId = entry.Id,
                Version = 1,
                VersionState = VersionState.Draft,
                SystemMessage = request.SystemMessage,
                Prompts = prompts,
                CreatedAt = now
            }, ct);

            return ((PromptEntry Entry, PromptEntryVersion Version))(entry, version);
        }, ct);
    }

    public async Task<ErrorOr<(PromptEntry Entry, PromptEntryVersion WorkingVersion)>> UpdateEntryAsync(
        Guid tenantId, Guid entryId, UpdateEntryRequest request, CancellationToken ct)
    {
        var entry = await entryRepo.GetByIdAsync(tenantId, entryId, ct);
        if (entry is null)
            return DomainErrors.EntryNotFound;

        var working = await entryRepo.GetWorkingVersionAsync(tenantId, entryId, ct);
        if (working is null)
            return DomainErrors.VersionNotFound;

        return await db.Database.InTransactionAsync(async () =>
        {
            var now = DateTime.UtcNow;

            if (working.VersionState == VersionState.Draft)
            {
                if (request.Title is not null) entry.Title = request.Title.Trim();
                if (request.SystemMessage is not null) working.SystemMessage = request.SystemMessage;
                if (request.Prompts is not null)
                    await entryRepo.ReplacePromptsAsync(working, BuildPrompts(request.Prompts), ct);

                entry.UpdatedAt = now;
                await entryRepo.UpdateAsync(entry, ct);
                await entryRepo.UpdateVersionAsync(working, ct);
            }
            else
            {
                var maxVersion = await entryRepo.GetMaxVersionNumberAsync(tenantId, entryId, ct);
                if (request.Title is not null) entry.Title = request.Title.Trim();
                entry.UpdatedAt = now;
                await entryRepo.UpdateAsync(entry, ct);

                working = await entryRepo.CreateVersionAsync(new PromptEntryVersion
                {
                    Id = Guid.NewGuid(),
                    EntryId = entryId,
                    Version = maxVersion + 1,
                    VersionState = VersionState.Draft,
                    SystemMessage = request.SystemMessage ?? working.SystemMessage,
                    Prompts = request.Prompts is not null ? BuildPrompts(request.Prompts) : working.Prompts,
                    CreatedAt = now
                }, ct);
            }

            return (entry, working);
        }, ct);
    }

    public async Task<ErrorOr<(PromptEntry Entry, PromptEntryVersion PublishedVersion)>> PublishDraftAsync(
        Guid tenantId, Guid entryId, Guid userId, CancellationToken ct)
    {
        var entry = await entryRepo.GetByIdAsync(tenantId, entryId, ct);
        if (entry is null)
            return DomainErrors.EntryNotFound;

        var draft = await entryRepo.GetWorkingVersionAsync(tenantId, entryId, ct);
        if (draft is null || draft.VersionState != VersionState.Draft)
            return Error.Conflict("NO_DRAFT", "No draft version to publish.");

        return await db.Database.InTransactionAsync(async () =>
        {
            var now = DateTime.UtcNow;

            var currentPublished = await entryRepo.GetPublishedVersionAsync(tenantId, entryId, ct);
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

            return (entry, draft);
        }, ct);
    }

    public async Task<ErrorOr<(PromptEntry Entry, PromptEntryVersion NewDraft)>> PromoteVersionAsync(
        Guid tenantId, Guid entryId, int version, CancellationToken ct)
    {
        var entry = await entryRepo.GetByIdAsync(tenantId, entryId, ct);
        if (entry is null)
            return DomainErrors.EntryNotFound;

        var historical = await entryRepo.GetVersionAsync(tenantId, entryId, version, ct);
        if (historical is null || historical.VersionState != VersionState.Historical)
            return DomainErrors.HistoricalVersionNotFound;

        return await db.Database.InTransactionAsync(async () =>
        {
            var now = DateTime.UtcNow;
            var maxVersion = await entryRepo.GetMaxVersionNumberAsync(tenantId, entryId, ct);

            var workingVersion = await entryRepo.GetWorkingVersionAsync(tenantId, entryId, ct);
            if (workingVersion?.VersionState == VersionState.Draft)
                await entryRepo.DeleteVersionAsync(workingVersion, ct);

            var newDraftId = Guid.NewGuid();
            var clonedPrompts = historical.Prompts.Select(p =>
            {
                var newPromptId = Guid.NewGuid();
                return new Prompt
                {
                    Id = newPromptId,
                    VersionId = newDraftId,
                    Content = p.Content,
                    Order = p.Order,
                    IsTemplate = p.IsTemplate,
                    TemplateFields = p.TemplateFields.Select(tf => new TemplateField
                    {
                        Id = Guid.NewGuid(),
                        PromptId = newPromptId,
                        Name = tf.Name,
                        Type = tf.Type,
                        EnumValues = tf.EnumValues,
                        DefaultValue = tf.DefaultValue,
                        Min = tf.Min,
                        Max = tf.Max
                    }).ToList()
                };
            }).ToList();

            var newDraft = await entryRepo.CreateVersionAsync(new PromptEntryVersion
            {
                Id = newDraftId,
                EntryId = entryId,
                Version = maxVersion + 1,
                VersionState = VersionState.Draft,
                SystemMessage = historical.SystemMessage,
                Prompts = clonedPrompts,
                PublishedAt = null,
                PublishedBy = null,
                CreatedAt = now
            }, ct);

            entry.UpdatedAt = now;
            await entryRepo.UpdateAsync(entry, ct);

            return (entry, newDraft);
        }, ct);
    }

    public async Task<ErrorOr<PromptEntry>> DeleteDraftAsync(
        Guid tenantId, Guid entryId, CancellationToken ct)
    {
        var entry = await entryRepo.GetByIdAsync(tenantId, entryId, ct);
        if (entry is null)
            return DomainErrors.EntryNotFound;

        var working = await entryRepo.GetWorkingVersionAsync(tenantId, entryId, ct);
        if (working is null || working.VersionState != VersionState.Draft)
            return Error.Validation("NO_DRAFT", "No draft version exists for this entry.");

        var published = await entryRepo.GetPublishedVersionAsync(tenantId, entryId, ct);
        if (published is null)
            return Error.Validation("NO_PUBLISHED_VERSION", "Cannot delete the only version. A published version must exist to fall back to.");

        return await db.Database.InTransactionAsync(async () =>
        {
            await entryRepo.DeleteVersionAsync(working, ct);

            entry.UpdatedAt = DateTime.UtcNow;
            await entryRepo.UpdateAsync(entry, ct);

            return entry;
        }, ct);
    }

    public async Task<ErrorOr<PromptEntry>> MoveEntryAsync(
        Guid tenantId, Guid entryId, Guid? folderId, CancellationToken ct)
    {
        var entry = await entryRepo.GetByIdAsync(tenantId, entryId, ct);
        if (entry is null)
            return DomainErrors.EntryNotFound;

        if (folderId is not null && await folderRepo.GetByIdAsync(tenantId, folderId.Value, ct) is null)
            return DomainErrors.TargetFolderNotFound;

        return await db.Database.InTransactionAsync(async () =>
        {
            entry.FolderId = folderId;
            entry.UpdatedAt = DateTime.UtcNow;
            await entryRepo.UpdateAsync(entry, ct);

            return entry;
        }, ct);
    }

    public async Task<ErrorOr<PromptEntry>> TrashEntryAsync(Guid tenantId, Guid entryId, CancellationToken ct)
    {
        var entry = await entryRepo.GetByIdAsync(tenantId, entryId, ct);
        if (entry is null)
            return DomainErrors.EntryNotFound;

        return await db.Database.InTransactionAsync(async () =>
        {
            entry.IsTrashed = true;
            entry.UpdatedAt = DateTime.UtcNow;
            await entryRepo.UpdateAsync(entry, ct);

            return entry;
        }, ct);
    }

    public async Task<ErrorOr<PromptEntry>> RestoreEntryAsync(Guid tenantId, Guid entryId, CancellationToken ct)
    {
        var entry = await entryRepo.GetByIdAsync(tenantId, entryId, ct);
        if (entry is null)
            return DomainErrors.EntryNotFound;

        if (!entry.IsTrashed)
            return Error.Conflict("NOT_TRASHED", "Entry is not in trash.");

        return await db.Database.InTransactionAsync(async () =>
        {
            entry.IsTrashed = false;
            entry.UpdatedAt = DateTime.UtcNow;
            await entryRepo.UpdateAsync(entry, ct);

            return entry;
        }, ct);
    }

    public async Task<ErrorOr<PromptEntry>> DeleteEntryPermanentlyAsync(Guid tenantId, Guid entryId, CancellationToken ct)
    {
        var entry = await entryRepo.GetByIdAsync(tenantId, entryId, ct);
        if (entry is null)
            return DomainErrors.EntryNotFound;

        if (!entry.IsTrashed)
            return Error.Conflict("NOT_TRASHED", "Entry must be trashed before permanent deletion.");

        await db.Database.InTransactionAsync(async () =>
        {
            await entryRepo.DeleteAsync(tenantId, entryId, ct);
        }, ct);
        return entry;
    }

    public async Task<ErrorOr<(PromptEntry Entry, PromptEntryVersion PublishedVersion)>> GetPublishedEntryAsync(
        Guid tenantId, Guid entryId, CancellationToken ct)
    {
        var entry = await entryRepo.GetByIdAsync(tenantId, entryId, ct);
        if (entry is null || entry.IsTrashed)
            return DomainErrors.EntryNotFoundByCode;

        var published = await entryRepo.GetPublishedVersionAsync(tenantId, entryId, ct);
        if (published is null)
            return DomainErrors.NoPublishedVersion;

        return (entry, published);
    }

    public string? ValidateCreateRequest(CreateEntryRequest request)
    {
        if (string.IsNullOrWhiteSpace(request.Title))
            return "Title is required.";
        if (request.Title.Trim().Length > 500)
            return "Title must be 500 characters or fewer.";
        if (request.Prompts is null || request.Prompts.Count == 0)
            return "At least one prompt is required.";
        return ValidatePromptContentLength(request.Prompts);
    }

    public string? ValidateUpdateRequest(UpdateEntryRequest request)
    {
        if (request.Title is not null && request.Title.Trim().Length > 500)
            return "Title must be 500 characters or fewer.";
        if (request.Prompts is not null)
            return ValidatePromptContentLength(request.Prompts);
        return null;
    }

    private static string? ValidatePromptContentLength(List<PromptInput> prompts)
    {
        for (var i = 0; i < prompts.Count; i++)
        {
            if (prompts[i].Content.Length > MaxPromptContentLength)
                return $"Prompt #{i + 1} content exceeds maximum length of {MaxPromptContentLength:N0} characters.";
        }
        return null;
    }

    private static List<Prompt> BuildPrompts(List<PromptInput> inputs)
    {
        return inputs.Select((pi, i) =>
        {
            var fields = TemplateParser.Parse(pi.Content);
            var isTemplate = pi.IsTemplate || fields.Count > 0;
            return new Prompt
            {
                Id = Guid.NewGuid(),
                Content = pi.Content,
                Order = i,
                IsTemplate = isTemplate,
                TemplateFields = isTemplate ? fields : []
            };
        }).ToList();
    }
}
