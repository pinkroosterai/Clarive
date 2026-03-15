using Clarive.Api.Models.Entities;

namespace Clarive.Api.Repositories.Interfaces;

public interface IServiceConfigRepository
{
    Task<Dictionary<string, ServiceConfig>> GetAllAsync(CancellationToken ct = default);
    Task<ServiceConfig?> GetByKeyAsync(string key, CancellationToken ct = default);
    Task CreateOrUpdateAsync(ServiceConfig config, CancellationToken ct = default);
    Task<bool> DeleteByKeyAsync(string key, CancellationToken ct = default);
}
