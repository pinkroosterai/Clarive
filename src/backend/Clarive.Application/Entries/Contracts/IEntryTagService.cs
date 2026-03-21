using ErrorOr;

namespace Clarive.Application.Entries.Contracts;

public interface IEntryTagService
{
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
