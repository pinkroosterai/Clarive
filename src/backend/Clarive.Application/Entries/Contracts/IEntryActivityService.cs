using ErrorOr;

namespace Clarive.Application.Entries.Contracts;

public interface IEntryActivityService
{
    Task<ErrorOr<EntryActivityResponse>> GetEntryActivityAsync(
        Guid tenantId,
        Guid entryId,
        int page,
        int pageSize,
        CancellationToken ct = default
    );
}
