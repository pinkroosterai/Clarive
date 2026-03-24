using Clarive.Domain.Entities;
using ErrorOr;

namespace Clarive.Application.Entries.Contracts;

public interface IEntryVersionService
{
    Task<ErrorOr<(PromptEntry Entry, PromptEntryVersion PublishedVersion)>> PublishTabAsync(
        Guid tenantId,
        Guid entryId,
        Guid tabId,
        Guid userId,
        CancellationToken ct = default
    );

    Task<ErrorOr<(PromptEntry Entry, PromptEntryVersion RestoredTab)>> RestoreVersionAsync(
        Guid tenantId,
        Guid entryId,
        int version,
        Guid? targetTabId = null,
        CancellationToken ct = default
    );

    Task<ErrorOr<List<VersionInfo>>> GetVersionHistoryAsync(
        Guid tenantId,
        Guid entryId,
        CancellationToken ct = default
    );
}
