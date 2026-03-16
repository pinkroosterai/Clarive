using Clarive.Api.Data;
using Clarive.Api.Models.Entities;
using Clarive.Api.Repositories.Interfaces;
using Microsoft.EntityFrameworkCore;

namespace Clarive.Api.Repositories.EfCore;

public class EfAiProviderRepository(ClariveDbContext db) : IAiProviderRepository
{
    public async Task<List<AiProvider>> GetAllAsync(CancellationToken ct = default)
    {
        return await db.AiProviders
            .Include(p => p.Models.OrderBy(m => m.SortOrder))
            .OrderBy(p => p.SortOrder)
            .ThenBy(p => p.Name)
            .AsNoTracking()
            .ToListAsync(ct);
    }

    public async Task<AiProvider?> GetByIdAsync(Guid id, CancellationToken ct = default)
    {
        return await db.AiProviders
            .Include(p => p.Models.OrderBy(m => m.SortOrder))
            .FirstOrDefaultAsync(p => p.Id == id, ct);
    }

    public async Task<AiProvider> CreateAsync(AiProvider provider, CancellationToken ct = default)
    {
        db.AiProviders.Add(provider);
        await db.SaveChangesAsync(ct);
        return provider;
    }

    public async Task UpdateAsync(AiProvider provider, CancellationToken ct = default)
    {
        db.AiProviders.Update(provider);
        await db.SaveChangesAsync(ct);
    }

    public async Task<bool> DeleteAsync(Guid id, CancellationToken ct = default)
    {
        var deleted = await db.AiProviders
            .Where(p => p.Id == id)
            .ExecuteDeleteAsync(ct);
        return deleted > 0;
    }

    public async Task<AiProviderModel> AddModelAsync(AiProviderModel model, CancellationToken ct = default)
    {
        db.AiProviderModels.Add(model);
        await db.SaveChangesAsync(ct);
        return model;
    }

    public async Task UpdateModelAsync(AiProviderModel model, CancellationToken ct = default)
    {
        db.AiProviderModels.Update(model);
        await db.SaveChangesAsync(ct);
    }

    public async Task<bool> DeleteModelAsync(Guid modelId, CancellationToken ct = default)
    {
        var deleted = await db.AiProviderModels
            .Where(m => m.Id == modelId)
            .ExecuteDeleteAsync(ct);
        return deleted > 0;
    }

    public async Task<AiProviderModel?> GetModelByIdAsync(Guid modelId, CancellationToken ct = default)
    {
        return await db.AiProviderModels
            .FirstOrDefaultAsync(m => m.Id == modelId, ct);
    }

    public async Task<(decimal? InputCostPerMillion, decimal? OutputCostPerMillion)?> GetModelCostAsync(
        string providerName, string modelId, CancellationToken ct = default)
    {
        var cost = await db.AiProviderModels
            .Where(m => m.Provider.Name == providerName && m.ModelId == modelId)
            .Select(m => new { m.InputCostPerMillion, m.OutputCostPerMillion })
            .AsNoTracking()
            .FirstOrDefaultAsync(ct);

        return cost is null ? null : (cost.InputCostPerMillion, cost.OutputCostPerMillion);
    }
}
