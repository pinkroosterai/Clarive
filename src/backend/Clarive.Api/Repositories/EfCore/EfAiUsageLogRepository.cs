using Clarive.Api.Data;
using Clarive.Api.Models.Entities;
using Clarive.Api.Models.Enums;
using Clarive.Api.Models.Responses;
using Clarive.Api.Repositories.Interfaces;
using Microsoft.EntityFrameworkCore;

namespace Clarive.Api.Repositories.EfCore;

public class EfAiUsageLogRepository(ClariveDbContext db) : IAiUsageLogRepository
{
    public async Task<AiUsageLog> AddAsync(AiUsageLog log, CancellationToken ct = default)
    {
        db.AiUsageLogs.Add(log);
        await db.SaveChangesAsync(ct);
        return log;
    }

    public async Task<AiUsagePagedResponse> GetFilteredAsync(
        AiUsageFilterRequest filter, int page, int pageSize, CancellationToken ct = default)
    {
        var query = ApplyFilters(db.AiUsageLogs.AsQueryable(), filter);

        var totalCount = await query.LongCountAsync(ct);

        var items = await query
            .OrderByDescending(l => l.CreatedAt)
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .Select(l => new AiUsageLogResponse(
                l.Id, l.TenantId, l.UserId,
                l.ActionType.ToString(), l.Model, l.Provider,
                l.Provider != "" ? l.Provider + ":" + l.Model : l.Model,
                l.InputTokens, l.OutputTokens, l.InputTokens + l.OutputTokens,
                l.EstimatedInputCostUsd, l.EstimatedOutputCostUsd,
                l.DurationMs, l.EntryId, l.CreatedAt))
            .ToListAsync(ct);

        return new AiUsagePagedResponse(items, page, pageSize, totalCount);
    }

    public async Task<AiUsageStatsResponse> GetStatsAsync(
        AiUsageFilterRequest filter, CancellationToken ct = default)
    {
        var query = ApplyFilters(db.AiUsageLogs.AsQueryable(), filter);

        var totals = await query
            .GroupBy(_ => 1)
            .Select(g => new AiUsageTotals(
                g.LongCount(),
                g.Sum(l => l.InputTokens),
                g.Sum(l => l.OutputTokens),
                g.Sum(l => l.InputTokens + l.OutputTokens),
                g.Sum(l => l.EstimatedInputCostUsd ?? 0),
                g.Sum(l => l.EstimatedOutputCostUsd ?? 0),
                g.Sum(l => (l.EstimatedInputCostUsd ?? 0) + (l.EstimatedOutputCostUsd ?? 0))))
            .FirstOrDefaultAsync(ct)
            ?? new AiUsageTotals(0, 0, 0, 0, 0, 0, 0);

        var averages = totals.TotalRequests > 0
            ? new AiUsageAverages(
                (double)totals.TotalInputTokens / totals.TotalRequests,
                (double)totals.TotalOutputTokens / totals.TotalRequests,
                (double)totals.TotalTokens / totals.TotalRequests)
            : new AiUsageAverages(0, 0, 0);

        var byModelRaw = await query
            .GroupBy(l => new { l.Provider, l.Model })
            .Select(g => new
            {
                Provider = g.Key.Provider,
                Model = g.Key.Model,
                RequestCount = g.LongCount(),
                InputTokens = g.Sum(l => l.InputTokens),
                OutputTokens = g.Sum(l => l.OutputTokens),
                InputCost = g.Sum(l => l.EstimatedInputCostUsd ?? 0),
                OutputCost = g.Sum(l => l.EstimatedOutputCostUsd ?? 0)
            })
            .ToListAsync(ct);

        var byModel = byModelRaw.Select(b => new AiUsageBreakdownItem(
            FormatDisplayModel(b.Provider, b.Model), b.RequestCount, b.InputTokens, b.OutputTokens,
            b.InputTokens + b.OutputTokens,
            totals.TotalTokens > 0 ? (double)(b.InputTokens + b.OutputTokens) / totals.TotalTokens * 100 : 0,
            b.InputCost, b.OutputCost, b.InputCost + b.OutputCost
        )).OrderByDescending(b => b.TotalTokens).ToList();

        var byTenant = await query
            .Join(db.Tenants, l => l.TenantId, t => t.Id, (l, t) => new { l, t.Name })
            .GroupBy(x => x.Name)
            .Select(g => new
            {
                Name = g.Key,
                RequestCount = g.LongCount(),
                InputTokens = g.Sum(x => x.l.InputTokens),
                OutputTokens = g.Sum(x => x.l.OutputTokens),
                InputCost = g.Sum(x => x.l.EstimatedInputCostUsd ?? 0),
                OutputCost = g.Sum(x => x.l.EstimatedOutputCostUsd ?? 0)
            })
            .ToListAsync(ct);

        var byTenantItems = byTenant.Select(b => new AiUsageBreakdownItem(
            b.Name, b.RequestCount, b.InputTokens, b.OutputTokens,
            b.InputTokens + b.OutputTokens,
            totals.TotalTokens > 0 ? (double)(b.InputTokens + b.OutputTokens) / totals.TotalTokens * 100 : 0,
            b.InputCost, b.OutputCost, b.InputCost + b.OutputCost
        )).OrderByDescending(b => b.TotalTokens).ToList();

        var byUser = await query
            .Join(db.Users.IgnoreQueryFilters(), l => l.UserId, u => u.Id, (l, u) => new { l, u.Email })
            .GroupBy(x => x.Email)
            .Select(g => new
            {
                Name = g.Key,
                RequestCount = g.LongCount(),
                InputTokens = g.Sum(x => x.l.InputTokens),
                OutputTokens = g.Sum(x => x.l.OutputTokens),
                InputCost = g.Sum(x => x.l.EstimatedInputCostUsd ?? 0),
                OutputCost = g.Sum(x => x.l.EstimatedOutputCostUsd ?? 0)
            })
            .ToListAsync(ct);

        var byUserItems = byUser.Select(b => new AiUsageBreakdownItem(
            b.Name, b.RequestCount, b.InputTokens, b.OutputTokens,
            b.InputTokens + b.OutputTokens,
            totals.TotalTokens > 0 ? (double)(b.InputTokens + b.OutputTokens) / totals.TotalTokens * 100 : 0,
            b.InputCost, b.OutputCost, b.InputCost + b.OutputCost
        )).OrderByDescending(b => b.TotalTokens).ToList();

        var byActionType = await GetBreakdownAsync(
            query, l => l.ActionType.ToString(), totals.TotalTokens, ct);

        return new AiUsageStatsResponse(totals, averages, byModel, byTenantItems, byUserItems, byActionType);
    }

    public async Task<AiUsageFilterOptionsResponse> GetFilterOptionsAsync(
        DateTime? dateFrom = null, DateTime? dateTo = null, CancellationToken ct = default)
    {
        var query = db.AiUsageLogs.AsQueryable();
        if (dateFrom.HasValue)
            query = query.Where(l => l.CreatedAt >= dateFrom.Value);
        if (dateTo.HasValue)
            query = query.Where(l => l.CreatedAt <= dateTo.Value);

        var models = await query
            .GroupBy(l => new { l.Provider, l.Model })
            .Select(g => new AiUsageFilterModel(
                g.Key.Model,
                g.Key.Provider != "" ? g.Key.Provider + ":" + g.Key.Model : g.Key.Model))
            .OrderBy(m => m.DisplayName)
            .ToListAsync(ct);

        var actionTypes = Enum.GetNames<AiActionType>().Order().ToList();

        var tenants = await query
            .Select(l => l.TenantId)
            .Distinct()
            .Join(db.Tenants, tid => tid, t => t.Id, (_, t) => new AiUsageFilterTenant(t.Id, t.Name))
            .OrderBy(t => t.Name)
            .ToListAsync(ct);

        return new AiUsageFilterOptionsResponse(models, actionTypes, tenants);
    }

    public async Task<int> DeleteOlderThanAsync(DateTime cutoff, CancellationToken ct = default)
    {
        return await db.AiUsageLogs
            .Where(l => l.CreatedAt < cutoff)
            .ExecuteDeleteAsync(ct);
    }

    private static IQueryable<AiUsageLog> ApplyFilters(IQueryable<AiUsageLog> query, AiUsageFilterRequest filter)
    {
        if (filter.TenantIds is { Count: > 0 })
            query = query.Where(l => filter.TenantIds.Contains(l.TenantId));
        if (filter.UserId.HasValue)
            query = query.Where(l => l.UserId == filter.UserId.Value);
        if (filter.Models is { Count: > 0 })
            query = query.Where(l => filter.Models.Contains(l.Model));
        if (filter.ActionTypes is { Count: > 0 })
            query = query.Where(l => filter.ActionTypes.Contains(l.ActionType));
        if (filter.DateFrom.HasValue)
            query = query.Where(l => l.CreatedAt >= filter.DateFrom.Value);
        if (filter.DateTo.HasValue)
            query = query.Where(l => l.CreatedAt <= filter.DateTo.Value);
        return query;
    }

    private static string FormatDisplayModel(string? provider, string model)
        => string.IsNullOrEmpty(provider) ? model : $"{provider}:{model}";

    private static async Task<List<AiUsageBreakdownItem>> GetBreakdownAsync(
        IQueryable<AiUsageLog> query, System.Linq.Expressions.Expression<Func<AiUsageLog, string>> groupKey,
        long totalTokens, CancellationToken ct)
    {
        var grouped = await query
            .GroupBy(groupKey)
            .Select(g => new
            {
                Name = g.Key,
                RequestCount = g.LongCount(),
                InputTokens = g.Sum(l => l.InputTokens),
                OutputTokens = g.Sum(l => l.OutputTokens),
                InputCost = g.Sum(l => l.EstimatedInputCostUsd ?? 0),
                OutputCost = g.Sum(l => l.EstimatedOutputCostUsd ?? 0)
            })
            .ToListAsync(ct);

        return grouped.Select(b => new AiUsageBreakdownItem(
            b.Name, b.RequestCount, b.InputTokens, b.OutputTokens,
            b.InputTokens + b.OutputTokens,
            totalTokens > 0 ? (double)(b.InputTokens + b.OutputTokens) / totalTokens * 100 : 0,
            b.InputCost, b.OutputCost, b.InputCost + b.OutputCost
        )).OrderByDescending(b => b.TotalTokens).ToList();
    }
}
