using Clarive.Application.Tabs.Contracts;
using Clarive.Domain.Entities;
using Clarive.Domain.Enums;
using Clarive.Domain.Errors;
using Clarive.Domain.Interfaces.Repositories;
using Clarive.Domain.Interfaces.Services;
using ErrorOr;
using Microsoft.Extensions.Logging;

namespace Clarive.Application.Tabs.Services;

public class TabService(
    IEntryRepository entryRepo,
    IUnitOfWork unitOfWork,
    ILogger<TabService> logger
) : ITabService
{
    private const int MaxTabsPerEntry = 20;

    public async Task<ErrorOr<TabInfo>> CreateAsync(
        Guid tenantId, Guid entryId, CreateTabRequest request, CancellationToken ct = default)
    {
        var validationErr = Common.Validator.ValidateRequest(request);
        if (validationErr is not null)
            return Error.Validation("VALIDATION_ERROR", "Invalid request.");

        var entry = await entryRepo.GetByIdAsync(tenantId, entryId, ct);
        if (entry is null)
            return DomainErrors.EntryNotFound;

        // Validate base version exists
        var baseVersion = await entryRepo.GetVersionAsync(tenantId, entryId, request.ForkedFromVersion, ct);
        if (baseVersion is null)
            return DomainErrors.VersionNotFound;

        // Check duplicate name
        var existing = await entryRepo.GetTabByNameAsync(tenantId, entryId, request.Name, ct);
        if (existing is not null)
            return DomainErrors.DuplicateTabName;

        // Check max tabs limit
        var tabs = await entryRepo.GetTabsAsync(tenantId, entryId, ct);
        if (tabs.Count >= MaxTabsPerEntry)
            return DomainErrors.MaxTabsExceeded;

        // Create tab by forking content from base version
        var tabId = Guid.NewGuid();
        var tab = new PromptEntryVersion
        {
            Id = tabId,
            EntryId = entryId,
            Version = 0, // Tabs don't have version numbers until published
            VersionState = VersionState.Tab,
            TabName = request.Name,
            ForkedFromVersion = request.ForkedFromVersion,
            IsMainTab = false,
            SystemMessage = baseVersion.SystemMessage,
            Prompts = Common.PromptCloner.ClonePrompts(baseVersion.Prompts, tabId),
            CreatedAt = DateTime.UtcNow,
        };

        await unitOfWork.ExecuteInTransactionAsync(async () =>
        {
            await entryRepo.CreateVersionAsync(tab, ct);
        }, ct);

        logger.LogInformation("Created tab '{TabName}' for entry {EntryId} based on v{BaseVersion}",
            request.Name, entryId, request.ForkedFromVersion);

        return new TabInfo(tab.Id, tab.TabName!, tab.ForkedFromVersion, tab.IsMainTab, tab.CreatedAt);
    }

    public async Task<ErrorOr<List<TabInfo>>> ListAsync(
        Guid tenantId, Guid entryId, CancellationToken ct = default)
    {
        var entry = await entryRepo.GetByIdAsync(tenantId, entryId, ct);
        if (entry is null)
            return DomainErrors.EntryNotFound;

        var tabs = await entryRepo.GetTabsAsync(tenantId, entryId, ct);

        return tabs.Select(v => new TabInfo(
            v.Id,
            v.TabName!,
            v.ForkedFromVersion,
            v.IsMainTab,
            v.CreatedAt
        )).ToList();
    }

    public async Task<ErrorOr<TabInfo>> RenameAsync(
        Guid tenantId, Guid entryId, Guid tabId, RenameTabRequest request, CancellationToken ct = default)
    {
        var validationErr = Common.Validator.ValidateRequest(request);
        if (validationErr is not null)
            return Error.Validation("VALIDATION_ERROR", "Invalid request.");

        var tab = await entryRepo.GetVersionByIdAsync(tenantId, tabId, ct);
        if (tab is null || tab.EntryId != entryId || tab.VersionState != VersionState.Tab)
            return DomainErrors.TabNotFound;

        // Check duplicate name
        var existing = await entryRepo.GetTabByNameAsync(tenantId, entryId, request.NewName, ct);
        if (existing is not null && existing.Id != tabId)
            return DomainErrors.DuplicateTabName;

        tab.TabName = request.NewName;
        await entryRepo.UpdateVersionAsync(tab, ct);

        return new TabInfo(tab.Id, tab.TabName!, tab.ForkedFromVersion, tab.IsMainTab, tab.CreatedAt);
    }

    public async Task<ErrorOr<bool>> DeleteAsync(
        Guid tenantId, Guid entryId, Guid tabId, CancellationToken ct = default)
    {
        var tab = await entryRepo.GetVersionByIdAsync(tenantId, tabId, ct);
        if (tab is null || tab.EntryId != entryId || tab.VersionState != VersionState.Tab)
            return DomainErrors.TabNotFound;

        if (tab.IsMainTab)
            return DomainErrors.CannotDeleteMainTab;

        await entryRepo.DeleteVersionAsync(tab, ct);

        logger.LogInformation("Deleted tab '{TabName}' ({TabId}) for entry {EntryId}",
            tab.TabName, tabId, entryId);

        return true;
    }
}
