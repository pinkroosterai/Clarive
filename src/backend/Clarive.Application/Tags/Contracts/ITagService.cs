using ErrorOr;

namespace Clarive.Application.Tags.Contracts;

public interface ITagService
{
    Task<List<TagSummary>> GetAllAsync(Guid tenantId, CancellationToken ct = default);
    Task<ErrorOr<Updated>> RenameAsync(Guid tenantId, string oldName, string newName, CancellationToken ct = default);
    Task DeleteAsync(Guid tenantId, string tagName, CancellationToken ct = default);
    Task<List<string>> GetByEntryIdAsync(Guid tenantId, Guid entryId, CancellationToken ct = default);
}
