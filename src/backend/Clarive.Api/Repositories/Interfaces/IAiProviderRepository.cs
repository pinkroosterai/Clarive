using Clarive.Api.Models.Entities;

namespace Clarive.Api.Repositories.Interfaces;

public interface IAiProviderRepository
{
    Task<List<AiProvider>> GetAllAsync(CancellationToken ct = default);
    Task<AiProvider?> GetByIdAsync(Guid id, CancellationToken ct = default);
    Task<AiProvider> CreateAsync(AiProvider provider, CancellationToken ct = default);
    Task UpdateAsync(AiProvider provider, CancellationToken ct = default);
    Task<bool> DeleteAsync(Guid id, CancellationToken ct = default);
    Task<AiProviderModel> AddModelAsync(AiProviderModel model, CancellationToken ct = default);
    Task UpdateModelAsync(AiProviderModel model, CancellationToken ct = default);
    Task<bool> DeleteModelAsync(Guid modelId, CancellationToken ct = default);
    Task<AiProviderModel?> GetModelByIdAsync(Guid modelId, CancellationToken ct = default);
    Task<(decimal? InputCostPerMillion, decimal? OutputCostPerMillion)?> GetModelCostAsync(string providerName, string modelId, CancellationToken ct = default);
}
