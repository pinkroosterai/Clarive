using Clarive.Domain.QueryResults;
using Clarive.Api.Data;
using Clarive.Domain.Entities;
using Clarive.Domain.Enums;
using Clarive.Api.Models.Responses;
using Clarive.Domain.Interfaces.Repositories;
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
        AiUsageFilterRequest filter,
        int page,
        int pageSize,
        string? sortBy = null,
        bool sortDesc = true,
        CancellationToken ct = default
    )
    {
        var query = ApplyFilters(db.AiUsageLogs.AsQueryable(), filter);

        var totalCount = await query.LongCountAsync(ct);

        var orderedQuery = ApplySorting(query, sortBy, sortDesc);

        var items = await orderedQuery
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .Join(db.Tenants, l => l.TenantId, t => t.Id, (l, t) => new { l, TenantName = t.Name })
            .Join(
                db.Users.IgnoreQueryFilters(),
                x => x.l.UserId,
                u => u.Id,
                (x, u) =>
                    new
                    {
                        x.l,
                        x.TenantName,
                        UserEmail = u.Email,
                    }
            )
            .Select(x => new AiUsageLogResponse(
                x.l.Id,
                x.l.TenantId,
                x.TenantName,
                x.l.UserId,
                x.UserEmail,
                x.l.ActionType.ToString(),
                x.l.Model,
                x.l.Provider,
                x.l.Provider != "" ? x.l.Provider + ":" + x.l.Model : x.l.Model,
                x.l.InputTokens,
                x.l.OutputTokens,
                x.l.InputTokens + x.l.OutputTokens,
                x.l.EstimatedInputCostUsd,
                x.l.EstimatedOutputCostUsd,
                x.l.DurationMs,
                x.l.EntryId,
                x.l.CreatedAt
            ))
            .ToListAsync(ct);

        return new AiUsagePagedResponse(items, page, pageSize, totalCount);
    }

    public async Task<AiUsageStatsResponse> GetStatsAsync(
        AiUsageFilterRequest filter,
        CancellationToken ct = default
    )
    {
        var query = ApplyFilters(db.AiUsageLogs.AsQueryable(), filter);

        var totals =
            await query
                .GroupBy(_ => 1)
                .Select(g => new AiUsageTotals(
                    g.LongCount(),
                    g.Sum(l => l.InputTokens),
                    g.Sum(l => l.OutputTokens),
                    g.Sum(l => l.InputTokens + l.OutputTokens),
                    g.Sum(l => l.EstimatedInputCostUsd ?? 0),
                    g.Sum(l => l.EstimatedOutputCostUsd ?? 0),
                    g.Sum(l => (l.EstimatedInputCostUsd ?? 0) + (l.EstimatedOutputCostUsd ?? 0))
                ))
                .FirstOrDefaultAsync(ct)
            ?? new AiUsageTotals(0, 0, 0, 0, 0, 0, 0);

        var averages =
            totals.TotalRequests > 0
                ? new AiUsageAverages(
                    (double)totals.TotalInputTokens / totals.TotalRequests,
                    (double)totals.TotalOutputTokens / totals.TotalRequests,
                    (double)totals.TotalTokens / totals.TotalRequests
                )
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
                OutputCost = g.Sum(l => l.EstimatedOutputCostUsd ?? 0),
            })
            .ToListAsync(ct);

        var byModel = byModelRaw
            .Select(b => new AiUsageBreakdownItem(
                FormatDisplayModel(b.Provider, b.Model),
                b.RequestCount,
                b.InputTokens,
                b.OutputTokens,
                b.InputTokens + b.OutputTokens,
                totals.TotalTokens > 0
                    ? (double)(b.InputTokens + b.OutputTokens) / totals.TotalTokens * 100
                    : 0,
                b.InputCost,
                b.OutputCost,
                b.InputCost + b.OutputCost
            ))
            .OrderByDescending(b => b.TotalTokens)
            .ToList();

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
                OutputCost = g.Sum(x => x.l.EstimatedOutputCostUsd ?? 0),
            })
            .ToListAsync(ct);

        var byTenantItems = byTenant
            .Select(b => new AiUsageBreakdownItem(
                b.Name,
                b.RequestCount,
                b.InputTokens,
                b.OutputTokens,
                b.InputTokens + b.OutputTokens,
                totals.TotalTokens > 0
                    ? (double)(b.InputTokens + b.OutputTokens) / totals.TotalTokens * 100
                    : 0,
                b.InputCost,
                b.OutputCost,
                b.InputCost + b.OutputCost
            ))
            .OrderByDescending(b => b.TotalTokens)
            .ToList();

        var byUser = await query
            .Join(
                db.Users.IgnoreQueryFilters(),
                l => l.UserId,
                u => u.Id,
                (l, u) => new { l, u.Email }
            )
            .GroupBy(x => x.Email)
            .Select(g => new
            {
                Name = g.Key,
                RequestCount = g.LongCount(),
                InputTokens = g.Sum(x => x.l.InputTokens),
                OutputTokens = g.Sum(x => x.l.OutputTokens),
                InputCost = g.Sum(x => x.l.EstimatedInputCostUsd ?? 0),
                OutputCost = g.Sum(x => x.l.EstimatedOutputCostUsd ?? 0),
            })
            .ToListAsync(ct);

        var byUserItems = byUser
            .Select(b => new AiUsageBreakdownItem(
                b.Name,
                b.RequestCount,
                b.InputTokens,
                b.OutputTokens,
                b.InputTokens + b.OutputTokens,
                totals.TotalTokens > 0
                    ? (double)(b.InputTokens + b.OutputTokens) / totals.TotalTokens * 100
                    : 0,
                b.InputCost,
                b.OutputCost,
                b.InputCost + b.OutputCost
            ))
            .OrderByDescending(b => b.TotalTokens)
            .ToList();

        var byActionType = await GetActionBreakdownAsync(query, ct);

        return new AiUsageStatsResponse(
            totals,
            averages,
            byModel,
            byTenantItems,
            byUserItems,
            byActionType
        );
    }

    public async Task<AiUsageFilterOptionsResponse> GetFilterOptionsAsync(
        DateTime? dateFrom = null,
        DateTime? dateTo = null,
        CancellationToken ct = default
    )
    {
        var query = db.AiUsageLogs.AsQueryable();
        if (dateFrom.HasValue)
            query = query.Where(l => l.CreatedAt >= dateFrom.Value);
        if (dateTo.HasValue)
            query = query.Where(l => l.CreatedAt <= dateTo.Value);

        var modelsRaw = await query
            .GroupBy(l => new { l.Provider, l.Model })
            .Select(g => new { g.Key.Provider, g.Key.Model })
            .ToListAsync(ct);

        var models = modelsRaw
            .Select(m => new AiUsageFilterModel(m.Model, FormatDisplayModel(m.Provider, m.Model)))
            .OrderBy(m => m.DisplayName)
            .ToList();

        var actionTypes = Enum.GetNames<AiActionType>().Order().ToList();

        var tenantIds = await query.Select(l => l.TenantId).Distinct().ToListAsync(ct);

        var tenants = await db
            .Tenants.Where(t => tenantIds.Contains(t.Id))
            .OrderBy(t => t.Name)
            .Select(t => new AiUsageFilterTenant(t.Id, t.Name))
            .ToListAsync(ct);

        return new AiUsageFilterOptionsResponse(models, actionTypes, tenants);
    }

    public async Task<int> DeleteOlderThanAsync(DateTime cutoff, CancellationToken ct = default)
    {
        return await db.AiUsageLogs.Where(l => l.CreatedAt < cutoff).ExecuteDeleteAsync(ct);
    }

    private static IOrderedQueryable<AiUsageLog> ApplySorting(
        IQueryable<AiUsageLog> query,
        string? sortBy,
        bool sortDesc
    )
    {
        return sortBy switch
        {
            "model" => sortDesc
                ? query.OrderByDescending(l => l.Model)
                : query.OrderBy(l => l.Model),
            "actionType" => sortDesc
                ? query.OrderByDescending(l => l.ActionType)
                : query.OrderBy(l => l.ActionType),
            "inputTokens" => sortDesc
                ? query.OrderByDescending(l => l.InputTokens)
                : query.OrderBy(l => l.InputTokens),
            "outputTokens" => sortDesc
                ? query.OrderByDescending(l => l.OutputTokens)
                : query.OrderBy(l => l.OutputTokens),
            "durationMs" => sortDesc
                ? query.OrderByDescending(l => l.DurationMs)
                : query.OrderBy(l => l.DurationMs),
            "estimatedInputCostUsd" => sortDesc
                ? query.OrderByDescending(l => l.EstimatedInputCostUsd)
                : query.OrderBy(l => l.EstimatedInputCostUsd),
            "estimatedOutputCostUsd" => sortDesc
                ? query.OrderByDescending(l => l.EstimatedOutputCostUsd)
                : query.OrderBy(l => l.EstimatedOutputCostUsd),
            _ => sortDesc
                ? query.OrderByDescending(l => l.CreatedAt)
                : query.OrderBy(l => l.CreatedAt),
        };
    }

    private static IQueryable<AiUsageLog> ApplyFilters(
        IQueryable<AiUsageLog> query,
        AiUsageFilterRequest filter
    )
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

    private static string FormatDisplayModel(string? provider, string model) =>
        string.IsNullOrEmpty(provider) ? model : $"{provider}:{model}";

    private static async Task<List<AiUsageActionBreakdownItem>> GetActionBreakdownAsync(
        IQueryable<AiUsageLog> query,
        CancellationToken ct
    )
    {
        // Aggregate per unique (action, provider, model) combination
        var grouped = await query
            .GroupBy(l => new
            {
                l.ActionType,
                l.Provider,
                l.Model,
            })
            .Select(g => new
            {
                g.Key.ActionType,
                g.Key.Provider,
                g.Key.Model,
                RequestCount = g.LongCount(),
                InputTokens = g.Sum(l => l.InputTokens),
                OutputTokens = g.Sum(l => l.OutputTokens),
                InputCost = g.Sum(l => l.EstimatedInputCostUsd ?? 0),
                OutputCost = g.Sum(l => l.EstimatedOutputCostUsd ?? 0),
                DurationMs = g.Sum(l => l.DurationMs),
            })
            .ToListAsync(ct);

        return grouped
            .Select(b =>
            {
                var rc = b.RequestCount > 0 ? b.RequestCount : 1;
                return new AiUsageActionBreakdownItem(
                    b.ActionType.ToString(),
                    b.Provider ?? "",
                    b.Model ?? "",
                    b.RequestCount,
                    (double)b.InputTokens / rc,
                    (double)b.OutputTokens / rc,
                    b.InputCost / rc,
                    b.OutputCost / rc,
                    (double)b.DurationMs / rc
                );
            })
            .OrderByDescending(b => b.RequestCount)
            .ToList();
    }
}
