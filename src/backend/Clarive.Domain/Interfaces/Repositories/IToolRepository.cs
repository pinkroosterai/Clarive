using Clarive.Domain.Entities;

namespace Clarive.Domain.Interfaces.Repositories;

public interface IToolRepository
{
    Task<List<ToolDescription>> GetByTenantAsync(Guid tenantId, CancellationToken ct = default);
    Task<(List<ToolDescription> Tools, int Total)> GetByTenantPagedAsync(
        Guid tenantId,
        int page,
        int pageSize,
        CancellationToken ct = default
    );
    Task<ToolDescription?> GetByIdAsync(Guid tenantId, Guid toolId, CancellationToken ct = default);
    Task<List<ToolDescription>> GetByIdsAsync(
        Guid tenantId,
        IEnumerable<Guid> toolIds,
        CancellationToken ct = default
    );
    Task<ToolDescription> CreateAsync(ToolDescription tool, CancellationToken ct = default);
    Task<ToolDescription> UpdateAsync(ToolDescription tool, CancellationToken ct = default);
    Task<bool> DeleteAsync(Guid tenantId, Guid toolId, CancellationToken ct = default);
    Task CreateManyAsync(List<ToolDescription> tools, CancellationToken ct = default);
}
