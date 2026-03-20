using System.Diagnostics.CodeAnalysis;
using System.Text;
using Clarive.Core.Models.Responses;
using Npgsql;
using NpgsqlTypes;

namespace Clarive.Core.Endpoints;

public static class SystemLogEndpoints
{
    private const int MaxPageSize = 200;
    private const int DefaultPageSize = 50;

    // Serilog stores level as integer: 0=Verbose, 1=Debug, 2=Information, 3=Warning, 4=Error, 5=Fatal
    private static readonly Dictionary<string, int> LevelNameToInt = new(
        StringComparer.OrdinalIgnoreCase
    )
    {
        ["Verbose"] = 0,
        ["Debug"] = 1,
        ["Information"] = 2,
        ["Warning"] = 3,
        ["Error"] = 4,
        ["Fatal"] = 5,
    };

    private static readonly Dictionary<int, string> LevelIntToName = new()
    {
        [0] = "Verbose",
        [1] = "Debug",
        [2] = "Information",
        [3] = "Warning",
        [4] = "Error",
        [5] = "Fatal",
    };

    private static readonly HashSet<string> AllowedSortColumns = new(
        StringComparer.OrdinalIgnoreCase
    )
    {
        "timestamp",
        "level",
        "message",
    };

    public static RouteGroupBuilder MapSystemLogEndpoints(this IEndpointRouteBuilder app)
    {
        var group = app.MapGroup("/api/super/system-logs")
            .WithTags("System Logs")
            .RequireAuthorization("SuperUser");

        group.MapGet("/", HandleGetLogs);

        return group;
    }

    private static async Task<IResult> HandleGetLogs(
        NpgsqlDataSource db,
        string? levels,
        string? source,
        string? search,
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

        // Parse level filter
        int[]? levelInts = null;
        if (!string.IsNullOrWhiteSpace(levels))
        {
            levelInts = levels
                .Split(',', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries)
                .Where(l => LevelNameToInt.ContainsKey(l))
                .Select(l => LevelNameToInt[l])
                .ToArray();
            if (levelInts.Length == 0)
                levelInts = null;
        }

        // Build WHERE clause
        var where = new StringBuilder();

        if (levelInts is { Length: > 0 })
            where.Append(" AND level = ANY(@levels)");

        if (!string.IsNullOrWhiteSpace(source))
            where.Append(" AND properties::text ILIKE @source");

        if (!string.IsNullOrWhiteSpace(search))
            where.Append(" AND message ILIKE @search");

        if (dateFrom.HasValue)
            where.Append(" AND timestamp >= @dateFrom");

        if (dateTo.HasValue)
            where.Append(" AND timestamp <= @dateTo");

        var whereClause = where.ToString();

        // Determine sort column
        var sortColumn = "timestamp";
        if (!string.IsNullOrWhiteSpace(sortBy) && AllowedSortColumns.Contains(sortBy))
            sortColumn = sortBy;
        var sortDirection = sortDesc ? "DESC" : "ASC";

        var offset = (page - 1) * pageSize;

        await using var conn = await db.OpenConnectionAsync(ct);

        // Helper to add filter parameters to a command
        void AddFilterParams(NpgsqlCommand cmd)
        {
            if (levelInts is { Length: > 0 })
                cmd.Parameters.AddWithValue("@levels", levelInts);
            if (!string.IsNullOrWhiteSpace(source))
                cmd.Parameters.AddWithValue("@source", $"%{source}%");
            if (!string.IsNullOrWhiteSpace(search))
                cmd.Parameters.AddWithValue("@search", $"%{search}%");
            if (dateFrom.HasValue)
                cmd.Parameters.AddWithValue("@dateFrom", dateFrom.Value.ToUniversalTime());
            if (dateTo.HasValue)
                cmd.Parameters.AddWithValue("@dateTo", dateTo.Value.ToUniversalTime());
        }

        // Count query (sortColumn/whereClause are built from validated whitelists; all user input is parameterized)
        long totalCount;
#pragma warning disable CA2100
        await using (
            var countCmd = new NpgsqlCommand(
                $"SELECT COUNT(*) FROM logs WHERE 1=1{whereClause}",
                conn
            )
        )
#pragma warning restore CA2100
        {
            AddFilterParams(countCmd);
            totalCount = (long)(await countCmd.ExecuteScalarAsync(ct))!;
        }

        // Data query
        var dataSql = $"""
            SELECT id, timestamp, level, message, message_template, exception, properties
            FROM logs
            WHERE 1=1{whereClause}
            ORDER BY {sortColumn} {sortDirection}
            LIMIT @limit OFFSET @offset
            """;

        var items = new List<SystemLogEntry>();
#pragma warning disable CA2100
        await using (var dataCmd = new NpgsqlCommand(dataSql, conn))
#pragma warning restore CA2100
        {
            AddFilterParams(dataCmd);
            dataCmd.Parameters.AddWithValue("@limit", pageSize);
            dataCmd.Parameters.AddWithValue("@offset", offset);

            await using var reader = await dataCmd.ExecuteReaderAsync(ct);
            while (await reader.ReadAsync(ct))
            {
                var levelInt = reader.IsDBNull(2) ? 2 : reader.GetInt32(2);
                var props = reader.IsDBNull(6) ? null : reader.GetString(6);

                // Extract SourceContext from properties JSONB
                string? sourceContext = null;
                if (props is not null)
                {
                    try
                    {
                        var jsonDoc = System.Text.Json.JsonDocument.Parse(props);
                        if (jsonDoc.RootElement.TryGetProperty("SourceContext", out var sc))
                            sourceContext = sc.GetString();
                    }
                    catch
                    { /* ignore malformed JSON */
                    }
                }

                items.Add(
                    new SystemLogEntry(
                        Id: reader.IsDBNull(0) ? 0 : reader.GetInt64(0),
                        Timestamp: reader.GetDateTime(1),
                        Level: LevelIntToName.GetValueOrDefault(levelInt, "Information"),
                        SourceContext: sourceContext,
                        Message: reader.IsDBNull(3) ? "" : reader.GetString(3),
                        Exception: reader.IsDBNull(5) ? null : reader.GetString(5),
                        Properties: props
                    )
                );
            }
        }

        return Results.Ok(new SystemLogPagedResponse(items, page, pageSize, totalCount));
    }
}
