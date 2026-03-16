using Clarive.Api.Models.Entities;
using Clarive.Api.Models.Requests;
using ErrorOr;

namespace Clarive.Api.Services.Interfaces;

public interface IEntryService
{
    Task<ErrorOr<(PromptEntry Entry, PromptEntryVersion Version)>> CreateEntryAsync(
        Guid tenantId, Guid userId, CreateEntryRequest request, CancellationToken ct = default);

    Task<ErrorOr<(PromptEntry Entry, PromptEntryVersion WorkingVersion)>> UpdateEntryAsync(
        Guid tenantId, Guid entryId, UpdateEntryRequest request, CancellationToken ct = default);

    Task<ErrorOr<(PromptEntry Entry, PromptEntryVersion PublishedVersion)>> PublishDraftAsync(
        Guid tenantId, Guid entryId, Guid userId, CancellationToken ct = default);

    Task<ErrorOr<(PromptEntry Entry, PromptEntryVersion NewDraft)>> PromoteVersionAsync(
        Guid tenantId, Guid entryId, int version, CancellationToken ct = default);

    Task<ErrorOr<PromptEntry>> DeleteDraftAsync(
        Guid tenantId, Guid entryId, CancellationToken ct = default);

    Task<ErrorOr<PromptEntry>> MoveEntryAsync(
        Guid tenantId, Guid entryId, Guid? folderId, CancellationToken ct = default);

    Task<ErrorOr<PromptEntry>> TrashEntryAsync(Guid tenantId, Guid entryId, CancellationToken ct = default);

    Task<ErrorOr<PromptEntry>> RestoreEntryAsync(Guid tenantId, Guid entryId, CancellationToken ct = default);

    Task<ErrorOr<PromptEntry>> DeleteEntryPermanentlyAsync(Guid tenantId, Guid entryId, CancellationToken ct = default);

    Task<ErrorOr<(PromptEntry Entry, PromptEntryVersion PublishedVersion)>> GetPublishedEntryAsync(
        Guid tenantId, Guid entryId, CancellationToken ct = default);

    string? ValidateCreateRequest(CreateEntryRequest request);
    string? ValidateUpdateRequest(UpdateEntryRequest request);
}
