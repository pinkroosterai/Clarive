using System.ComponentModel;
using System.Text.Json;
using Clarive.Api.Auth;
using Clarive.Api.Helpers;
using Clarive.Api.Models.Enums;
using Clarive.Api.Models.Responses;
using Clarive.Api.Repositories.Interfaces;
using Clarive.Api.Services.Interfaces;
using Serilog;

namespace Clarive.Api.Endpoints;

public static partial class EntryEndpoints
{
    private static async Task<IResult> HandleGetActivity(
        Guid entryId,
        HttpContext ctx,
        IEntryRepository entryRepo,
        IAuditLogRepository auditRepo,
        CancellationToken ct,
        [Description("Page number (1-based)")] int? page = null,
        [Description("Items per page (max 50)")] int? pageSize = null)
    {
        var tenantId = ctx.GetTenantId();
        var entry = await entryRepo.GetByIdAsync(tenantId, entryId, ct);
        if (entry is null)
            return ctx.ErrorResult(404, "NOT_FOUND", "Entry not found.", "Entry", entryId.ToString());

        var p = page is > 0 ? page.Value : 1;
        var ps = pageSize is > 0 ? Math.Min(pageSize.Value, MaxActivityPageSize) : DefaultActivityPageSize;

        var (entries, total) = await auditRepo.GetByEntityIdAsync(tenantId, entryId, p, ps, ct);

        var items = entries.Select(a =>
        {
            // Extract version number from details if present (e.g., "Published version 2")
            int? version = null;
            if (a.Details is not null)
            {
                var match = VersionPattern().Match(a.Details);
                if (match.Success && int.TryParse(match.Groups[1].Value, out var v))
                    version = v;
            }

            return new EntryActivityItem(
                a.Id,
                JsonNamingPolicy.SnakeCaseLower.ConvertName(a.Action.ToString()),
                a.UserName,
                a.Details,
                version,
                a.Timestamp);
        }).ToList();

        return Results.Ok(new EntryActivityResponse(items, total, p, ps));
    }

    private static async Task SafeLogAsync(
        IAuditLogger auditLogger,
        Guid tenantId,
        Guid userId,
        string userName,
        AuditAction action,
        string entityType,
        Guid entityId,
        string entityTitle,
        string? details,
        CancellationToken ct)
    {
        try
        {
            await auditLogger.LogAsync(tenantId, userId, userName, action, entityType, entityId, entityTitle, details, ct);
        }
        catch (Exception ex)
        {
            // Audit logging failures must not affect the primary operation
            Log.Warning(ex, "Audit logging failed for {Action} on {EntityType} {EntityId}", action, entityType, entityId);
        }
    }
}
