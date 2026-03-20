using Clarive.Domain.QueryResults;
using Clarive.Domain.Enums;
using Clarive.Api.Models.Responses;
using Clarive.Domain.Interfaces.Repositories;

namespace Clarive.Api.Endpoints;

public static class AiUsageEndpoints
{
    private const int MaxPageSize = 200;
    private const int DefaultPageSize = 50;

    public static RouteGroupBuilder MapAiUsageEndpoints(this IEndpointRouteBuilder app)
    {
        var group = app.MapGroup("/api/super/ai-usage")
            .WithTags("AI Usage")
            .RequireAuthorization("SuperUser");

        group.MapGet("/", HandleGetUsageLogs);
        group.MapGet("/stats", HandleGetUsageStats);
        group.MapGet("/filters", HandleGetFilterOptions);

        return group;
    }

    private static async Task<IResult> HandleGetUsageLogs(
        IAiUsageLogRepository repo,
        string? tenantId,
        Guid? userId,
        string? model,
        string? actionType,
        DateTime? dateFrom,
        DateTime? dateTo,
        string? sortBy,
        bool sortDesc = true,
        int page = 1,
        int pageSize = DefaultPageSize,
        CancellationToken ct = default
    )
    {
        if (dateFrom.HasValue && dateTo.HasValue && dateFrom > dateTo)
            return Results.BadRequest(
                new
                {
                    error = new
                    {
                        code = "INVALID_DATE_RANGE",
                        message = "dateFrom must be before dateTo",
                    },
                }
            );

        if (page < 1)
            page = 1;
        if (pageSize < 1)
            pageSize = DefaultPageSize;
        if (pageSize > MaxPageSize)
            pageSize = MaxPageSize;

        var filter = new AiUsageFilterRequest(
            ParseGuids(tenantId),
            userId,
            ParseStrings(model),
            ParseActionTypes(actionType),
            dateFrom,
            dateTo
        );
        var result = await repo.GetFilteredAsync(filter, page, pageSize, sortBy, sortDesc, ct);
        return Results.Ok(result);
    }

    private static async Task<IResult> HandleGetFilterOptions(
        IAiUsageLogRepository repo,
        DateTime? dateFrom,
        DateTime? dateTo,
        CancellationToken ct = default
    )
    {
        var result = await repo.GetFilterOptionsAsync(dateFrom, dateTo, ct);
        return Results.Ok(result);
    }

    private static async Task<IResult> HandleGetUsageStats(
        IAiUsageLogRepository repo,
        string? tenantId,
        Guid? userId,
        string? model,
        string? actionType,
        DateTime? dateFrom,
        DateTime? dateTo,
        CancellationToken ct = default
    )
    {
        if (dateFrom.HasValue && dateTo.HasValue && dateFrom > dateTo)
            return Results.BadRequest(
                new
                {
                    error = new
                    {
                        code = "INVALID_DATE_RANGE",
                        message = "dateFrom must be before dateTo",
                    },
                }
            );

        var filter = new AiUsageFilterRequest(
            ParseGuids(tenantId),
            userId,
            ParseStrings(model),
            ParseActionTypes(actionType),
            dateFrom,
            dateTo
        );
        var result = await repo.GetStatsAsync(filter, ct);
        return Results.Ok(result);
    }

    private static List<string>? ParseStrings(string? value) =>
        string.IsNullOrWhiteSpace(value)
            ? null
            : value
                .Split(',', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries)
                .ToList();

    private static List<Guid>? ParseGuids(string? value) =>
        string.IsNullOrWhiteSpace(value)
            ? null
            : value
                .Split(',', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries)
                .Where(s => Guid.TryParse(s, out _))
                .Select(Guid.Parse)
                .ToList();

    private static List<AiActionType>? ParseActionTypes(string? value) =>
        string.IsNullOrWhiteSpace(value)
            ? null
            : value
                .Split(',', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries)
                .Where(s => Enum.TryParse<AiActionType>(s, out _))
                .Select(Enum.Parse<AiActionType>)
                .ToList();
}
