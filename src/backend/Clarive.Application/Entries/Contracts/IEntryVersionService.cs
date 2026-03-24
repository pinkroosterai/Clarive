using Clarive.Domain.Entities;
using ErrorOr;

namespace Clarive.Application.Entries.Contracts;

public interface IEntryVersionService
{
    Task<ErrorOr<(PromptEntry Entry, PromptEntryVersion PublishedVersion)>> PublishDraftAsync(
        Guid tenantId,
        Guid entryId,
        Guid userId,
        CancellationToken ct = default
    );

    Task<ErrorOr<(PromptEntry Entry, PromptEntryVersion PublishedVersion)>> PublishVariantAsync(
        Guid tenantId,
        Guid entryId,
        Guid variantId,
        Guid userId,
        CancellationToken ct = default
    );

    Task<ErrorOr<(PromptEntry Entry, PromptEntryVersion NewDraft)>> PromoteVersionAsync(
        Guid tenantId,
        Guid entryId,
        int version,
        CancellationToken ct = default
    );

    Task<ErrorOr<PromptEntry>> DeleteDraftAsync(
        Guid tenantId,
        Guid entryId,
        CancellationToken ct = default
    );

    Task<ErrorOr<List<VersionInfo>>> GetVersionHistoryAsync(
        Guid tenantId,
        Guid entryId,
        CancellationToken ct = default
    );
}
