using Clarive.Api.Data;
using Clarive.Api.Models.Enums;
using Clarive.Api.Models.Requests;
using Clarive.Api.Services;
using Clarive.Api.Services.Interfaces;
using Microsoft.EntityFrameworkCore;
using Clarive.Api.Auth;

namespace Clarive.Api.Endpoints;

public static class SuperEndpoints
{
    public static RouteGroupBuilder MapSuperEndpoints(this IEndpointRouteBuilder app)
    {
        var group = app.MapGroup("/api/super")
            .WithTags("Super Admin")
            .RequireAuthorization("SuperUser");

        group.MapGet("/stats", HandleGetStats);
        group.MapGet("/maintenance", HandleGetMaintenance);
        group.MapPost("/maintenance", HandleSetMaintenance);

        return group;
    }

    private static async Task<IResult> HandleGetStats(
        ClariveDbContext db,
        CancellationToken ct)
    {
        var now = DateTime.UtcNow;
        var days7 = now.AddDays(-7);
        var days30 = now.AddDays(-30);

        // Users & Growth
        var activeUsers = db.Users.IgnoreQueryFilters().Where(u => u.DeletedAt == null);
        var totalUsers = await activeUsers.CountAsync(ct);
        var newUsers7d = await activeUsers.CountAsync(u => u.CreatedAt >= days7, ct);
        var newUsers30d = await activeUsers.CountAsync(u => u.CreatedAt >= days30, ct);
        var verifiedPct = totalUsers > 0
            ? (double)await activeUsers.CountAsync(u => u.EmailVerified, ct) / totalUsers
            : 0;
        var onboardedPct = totalUsers > 0
            ? (double)await activeUsers.CountAsync(u => u.OnboardingCompleted, ct) / totalUsers
            : 0;
        var pendingDeletion = await activeUsers.CountAsync(u => u.DeleteScheduledAt != null, ct);
        var googleAuthUsers = await activeUsers.CountAsync(u => u.GoogleId != null, ct);

        // Workspaces
        var totalWorkspaces = await db.Tenants.CountAsync(t => t.DeletedAt == null, ct);
        var allMemberships = db.TenantMemberships.IgnoreQueryFilters();
        var sharedWorkspaces = await allMemberships
            .Where(m => !m.IsPersonal)
            .Select(m => m.TenantId)
            .Distinct()
            .CountAsync(ct);
        var avgMembersPerWorkspace = sharedWorkspaces > 0
            ? (double)await allMemberships.CountAsync(m => !m.IsPersonal, ct) / sharedWorkspaces
            : 0;
        var allInvitations = db.Invitations.IgnoreQueryFilters();
        var pendingInvitations = await allInvitations
            .CountAsync(i => i.TargetUserId == null && i.ExpiresAt > now, ct);
        var totalInvitations = await allInvitations.CountAsync(ct);
        var acceptedInvitations = await allInvitations.CountAsync(i => i.TargetUserId != null, ct);
        var invitationAcceptRate = totalInvitations > 0
            ? (double)acceptedInvitations / totalInvitations
            : 0;

        // Content
        var allEntries = db.PromptEntries.IgnoreQueryFilters();
        var totalEntries = await allEntries.CountAsync(ct);
        var publishedVersions = await db.PromptEntryVersions
            .CountAsync(v => v.VersionState == VersionState.Published, ct);
        var entriesCreated7d = await allEntries.CountAsync(e => e.CreatedAt >= days7, ct);
        var trashedEntries = await allEntries.CountAsync(e => e.IsTrashed, ct);
        var allAiSessions = db.AiSessions.IgnoreQueryFilters();
        var totalAiSessions = await allAiSessions.CountAsync(ct);
        var aiSessions7d = await allAiSessions.CountAsync(s => s.CreatedAt >= days7, ct);

        var totalApiKeys = await db.ApiKeys.IgnoreQueryFilters().CountAsync(ct);

        return Results.Ok(new
        {
            totalUsers,
            newUsers7d,
            newUsers30d,
            verifiedPct,
            onboardedPct,
            pendingDeletion,
            googleAuthUsers,
            totalWorkspaces,
            sharedWorkspaces,
            avgMembersPerWorkspace,
            pendingInvitations,
            invitationAcceptRate,
            totalEntries,
            publishedVersions,
            entriesCreated7d,
            trashedEntries,
            totalAiSessions,
            aiSessions7d,
            totalApiKeys,
        });
    }

    private static IResult HandleGetMaintenance(
        IMaintenanceModeService maintenanceMode)
    {
        return Results.Ok(new { enabled = maintenanceMode.IsEnabled });
    }

    private static async Task<IResult> HandleSetMaintenance(
        HttpContext ctx,
        MaintenanceRequest request,
        IMaintenanceModeService maintenanceMode,
        IAuditLogger auditLogger,
        CancellationToken ct)
    {
        var changedBy = $"dashboard:{ctx.GetUserName()}";
        await maintenanceMode.SetEnabledAsync(request.Enabled, changedBy, ct);

        await auditLogger.SafeLogAsync(
            ctx.GetTenantId(),
            ctx.GetUserId(),
            ctx.GetUserName(),
            request.Enabled ? AuditAction.MaintenanceEnabled : AuditAction.MaintenanceDisabled,
            "System",
            Guid.Empty,
            "MaintenanceMode",
            $"Maintenance mode {(request.Enabled ? "enabled" : "disabled")} via dashboard",
            ct);

        return Results.Ok(new { enabled = maintenanceMode.IsEnabled });
    }
}
