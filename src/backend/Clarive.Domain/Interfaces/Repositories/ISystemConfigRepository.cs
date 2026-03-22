using Clarive.Domain.Entities;

namespace Clarive.Domain.Interfaces.Repositories;

public interface ISystemConfigRepository
{
    Task<SystemConfig?> GetAsync(CancellationToken ct = default);
    Task SaveAsync(SystemConfig config, CancellationToken ct = default);
}
