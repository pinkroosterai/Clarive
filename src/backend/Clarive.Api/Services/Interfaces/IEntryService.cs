using Clarive.Domain.Entities;
using Clarive.Api.Models.Requests;
using Clarive.Domain.ValueObjects;
using Clarive.Api.Models.Responses;
using Clarive.Domain.Interfaces.Repositories;
using ErrorOr;

namespace Clarive.Api.Services.Interfaces;

public interface IEntryService
{
    // List/read operations
    Task<ErrorOr<(List<PromptEntrySummary> Summaries, int TotalCount)>> ListEntriesAsync(
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
        CancellationToken ct = default
    );

    Task<ErrorOr<(List<PromptEntrySummary> Summaries, int TotalCount)>> ListTrashedEntriesAsync(
        Guid tenantId,
        Guid userId,
        int page,
        int pageSize,
        CancellationToken ct = default
    );

    Task<ErrorOr<object>> GetEntryDetailAsync(
        Guid tenantId,
        Guid userId,
        Guid entryId,
        CancellationToken ct = default
    );

    Task<ErrorOr<List<VersionInfo>>> GetVersionHistoryAsync(
        Guid tenantId,
        Guid entryId,
        CancellationToken ct = default
    );

    Task<ErrorOr<object>> GetVersionDetailAsync(
        Guid tenantId,
        Guid entryId,
        int version,
        CancellationToken ct = default
    );

    Task<ErrorOr<object>> BuildEntryResponseAsync(
        PromptEntry entry,
        PromptEntryVersion version,
        Guid tenantId,
        bool isFavorited = false,
        CancellationToken ct = default
    );

    Task<ErrorOr<PromptEntryVersion>> GetWorkingVersionAsync(
        Guid tenantId,
        Guid entryId,
        CancellationToken ct = default
    );

    Task<ErrorOr<(PromptEntry Entry, PromptEntryVersion Version)>> CreateEntryAsync(
        Guid tenantId,
        Guid userId,
        CreateEntryRequest request,
        CancellationToken ct = default
    );

    Task<ErrorOr<(PromptEntry Entry, PromptEntryVersion WorkingVersion)>> UpdateEntryAsync(
        Guid tenantId,
        Guid entryId,
        UpdateEntryRequest request,
        CancellationToken ct = default
    );

    Task<ErrorOr<(PromptEntry Entry, PromptEntryVersion PublishedVersion)>> PublishDraftAsync(
        Guid tenantId,
        Guid entryId,
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

    Task<ErrorOr<PromptEntry>> MoveEntryAsync(
        Guid tenantId,
        Guid entryId,
        Guid? folderId,
        CancellationToken ct = default
    );

    Task<ErrorOr<PromptEntry>> TrashEntryAsync(
        Guid tenantId,
        Guid entryId,
        CancellationToken ct = default
    );

    Task<ErrorOr<PromptEntry>> RestoreEntryAsync(
        Guid tenantId,
        Guid entryId,
        CancellationToken ct = default
    );

    Task<ErrorOr<PromptEntry>> DeleteEntryPermanentlyAsync(
        Guid tenantId,
        Guid entryId,
        CancellationToken ct = default
    );

    Task<ErrorOr<(PromptEntry Entry, PromptEntryVersion PublishedVersion)>> GetPublishedEntryAsync(
        Guid tenantId,
        Guid entryId,
        CancellationToken ct = default
    );

    // Activity
    Task<ErrorOr<EntryActivityResponse>> GetEntryActivityAsync(
        Guid tenantId,
        Guid entryId,
        int page,
        int pageSize,
        CancellationToken ct = default
    );

    // Favorite operations
    Task<ErrorOr<Success>> FavoriteEntryAsync(
        Guid tenantId,
        Guid userId,
        Guid entryId,
        CancellationToken ct = default
    );
    Task<ErrorOr<Success>> UnfavoriteEntryAsync(
        Guid tenantId,
        Guid userId,
        Guid entryId,
        CancellationToken ct = default
    );

    // Tag operations
    Task<ErrorOr<List<string>>> GetEntryTagsAsync(
        Guid tenantId,
        Guid entryId,
        CancellationToken ct = default
    );
    Task<ErrorOr<List<string>>> AddEntryTagsAsync(
        Guid tenantId,
        Guid entryId,
        List<string> tagNames,
        CancellationToken ct = default
    );
    Task<ErrorOr<Success>> RemoveEntryTagAsync(
        Guid tenantId,
        Guid entryId,
        string tagName,
        CancellationToken ct = default
    );
}
