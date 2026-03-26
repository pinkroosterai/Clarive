using Clarive.Api.Helpers;
using Clarive.Application.SuperAdmin.Contracts;
using Clarive.Domain.Enums;
using Clarive.Domain.Interfaces.Repositories;
using Clarive.Domain.ValueObjects;
using Quartz;
using Quartz.Impl.Matchers;

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
        group.MapGet("/users", HandleGetUsers);
        group.MapDelete("/users/{userId}", HandleDeleteUser);
        group.MapPost("/users", HandleCreateUser);
        group.MapPost("/users/{userId}/reset-password", HandleResetPassword);
        group.MapGet("/workspaces", HandleListWorkspaces);

        // ── Job monitoring & control ──
        group.MapGet("/jobs", HandleGetJobs);
        group.MapGet("/jobs/{name}/history", HandleGetJobHistory);
        group.MapPost("/jobs/{name}/trigger", HandleTriggerJob);
        group.MapPost("/jobs/{name}/pause", HandlePauseJob);
        group.MapPost("/jobs/{name}/resume", HandleResumeJob);
        group.MapPut("/jobs/{name}/schedule", HandleUpdateJobSchedule);

        return group;
    }

    private static async Task<IResult> HandleGetStats(
        ISuperAdminService superAdminService,
        CancellationToken ct
    )
    {
        var stats = await superAdminService.GetPlatformStatsAsync(ct);
        return Results.Ok(stats);
    }

    private static IResult HandleGetMaintenance(IMaintenanceModeService maintenanceMode)
    {
        return Results.Ok(new { enabled = maintenanceMode.IsEnabled });
    }

    private static async Task<IResult> HandleSetMaintenance(
        HttpContext ctx,
        MaintenanceRequest request,
        IMaintenanceModeService maintenanceMode,
        IAuditLogger auditLogger,
        CancellationToken ct
    )
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
            ct
        );

        return Results.Ok(new { enabled = maintenanceMode.IsEnabled });
    }

    private const int MaxPageSize = 200;

    private static async Task<IResult> HandleGetUsers(
        ISuperAdminService superAdminService,
        int page = 1,
        int pageSize = 20,
        string? search = null,
        string? role = null,
        string? authType = null,
        string? sortBy = null,
        bool sortDesc = true,
        CancellationToken ct = default
    )
    {
        pageSize = Math.Min(pageSize, MaxPageSize);
        var (users, total) = await superAdminService.GetAllUsersPagedAsync(
            page,
            pageSize,
            search,
            role,
            authType,
            sortBy,
            sortDesc,
            ct
        );
        return Results.Ok(new SuperUsersPagedResponse(users, total, page, pageSize));
    }

    private static async Task<IResult> HandleDeleteUser(
        HttpContext ctx,
        Guid userId,
        ISuperAdminService superAdminService,
        bool hard = false,
        CancellationToken ct = default
    )
    {
        var currentUserId = ctx.GetUserId();
        if (currentUserId == userId)
            return ctx.ErrorResult(409, "CANNOT_DELETE_SELF", "Cannot delete your own account.");

        bool found;
        if (hard)
            found = await superAdminService.HardDeleteUserAsync(userId, ct);
        else
            found = await superAdminService.SoftDeleteUserAsync(userId, ct);

        return found ? Results.NoContent() : Results.NotFound();
    }

    private static async Task<IResult> HandleResetPassword(
        HttpContext ctx,
        Guid userId,
        ISuperAdminService superAdminService,
        CancellationToken ct = default
    )
    {
        var result = await superAdminService.ResetUserPasswordAsync(userId, ct);

        if (result.IsError)
            return result.Errors.ToHttpResult(ctx);

        return Results.Ok(new ResetPasswordResponse(NewPassword: result.Value));
    }

    private static async Task<IResult> HandleCreateUser(
        HttpContext ctx,
        CreateUserRequest request,
        ISuperAdminService superAdminService,
        CancellationToken ct = default
    )
    {
        if (Validator.ValidateRequest(request) is { } validationErr)
            return validationErr;

        var result = await superAdminService.CreateUserAsync(request, ct);
        if (result.IsError)
            return result.Errors.ToHttpResult(ctx);

        return Results.Created($"/api/super/users/{result.Value.Id}", result.Value);
    }

    private static async Task<IResult> HandleListWorkspaces(
        ITenantRepository tenantRepo,
        CancellationToken ct = default
    )
    {
        var tenants = await tenantRepo.GetAllAsync(ct);
        var workspaces = tenants.Select(t => new { id = t.Id, name = t.Name }).ToList();
        return Results.Ok(workspaces);
    }

    // ── Job endpoints ──

    private static async Task<IResult> HandleGetJobs(
        ISchedulerFactory schedulerFactory,
        IJobHistoryService historyService,
        CancellationToken ct = default
    )
    {
        var scheduler = await schedulerFactory.GetScheduler(ct);
        var jobKeys = await scheduler.GetJobKeys(GroupMatcher<JobKey>.AnyGroup(), ct);

        var jobs = new List<object>();
        foreach (var key in jobKeys.OrderBy(k => k.Group).ThenBy(k => k.Name))
        {
            var triggers = await scheduler.GetTriggersOfJob(key, ct);
            var trigger = triggers.FirstOrDefault();

            string? cronExpression = null;
            string triggerState = "None";
            DateTimeOffset? nextFireTime = null;

            if (trigger is not null)
            {
                triggerState = (await scheduler.GetTriggerState(trigger.Key, ct)).ToString();
                nextFireTime = trigger.GetNextFireTimeUtc();
                if (trigger is ICronTrigger cronTrigger)
                    cronExpression = cronTrigger.CronExpressionString;
            }

            // Get latest execution from history
            DateTime? lastRunUtc = null;
            long? lastDurationMs = null;
            bool? lastSucceeded = null;

            var historyResult = await historyService.GetHistoryByJobAsync(key.Name, 1, 1, ct);
            if (!historyResult.IsError && historyResult.Value.Items.Count > 0)
            {
                var latest = historyResult.Value.Items[0];
                lastRunUtc = latest.FireTimeUtc;
                lastDurationMs = latest.DurationMs;
                lastSucceeded = latest.Succeeded;
            }

            jobs.Add(new
            {
                name = key.Name,
                group = key.Group,
                cronExpression,
                triggerState,
                lastRunUtc,
                nextFireTimeUtc = nextFireTime?.UtcDateTime,
                lastDurationMs,
                lastSucceeded,
            });
        }

        return Results.Ok(jobs);
    }

    private static async Task<IResult> HandleGetJobHistory(
        string name,
        IJobHistoryService historyService,
        int page = 1,
        int pageSize = 20,
        CancellationToken ct = default
    )
    {
        var result = await historyService.GetHistoryByJobAsync(name, page, pageSize, ct);

        if (result.IsError)
            return Results.BadRequest(new { error = result.FirstError.Description });

        var (items, total) = result.Value;
        return Results.Ok(new
        {
            items = items.Select(h => new
            {
                fireTimeUtc = h.FireTimeUtc,
                startedAtUtc = h.StartedAtUtc,
                finishedAtUtc = h.FinishedAtUtc,
                durationMs = h.DurationMs,
                succeeded = h.Succeeded,
                exceptionMessage = h.ExceptionMessage,
            }),
            totalCount = total,
            page,
            pageSize,
        });
    }

    private static async Task<IResult> HandleTriggerJob(
        string name,
        ISchedulerFactory schedulerFactory,
        CancellationToken ct = default
    )
    {
        var scheduler = await schedulerFactory.GetScheduler(ct);
        var jobKey = await FindJobKeyByNameAsync(scheduler, name, ct);
        if (jobKey is null) return Results.NotFound();

        await scheduler.TriggerJob(jobKey, ct);
        return Results.Ok(new { triggered = true });
    }

    private static async Task<IResult> HandlePauseJob(
        string name,
        ISchedulerFactory schedulerFactory,
        CancellationToken ct = default
    )
    {
        var scheduler = await schedulerFactory.GetScheduler(ct);
        var jobKey = await FindJobKeyByNameAsync(scheduler, name, ct);
        if (jobKey is null) return Results.NotFound();

        var triggers = await scheduler.GetTriggersOfJob(jobKey, ct);
        foreach (var trigger in triggers)
            await scheduler.PauseTrigger(trigger.Key, ct);

        return Results.Ok(new { paused = true });
    }

    private static async Task<IResult> HandleResumeJob(
        string name,
        ISchedulerFactory schedulerFactory,
        CancellationToken ct = default
    )
    {
        var scheduler = await schedulerFactory.GetScheduler(ct);
        var jobKey = await FindJobKeyByNameAsync(scheduler, name, ct);
        if (jobKey is null) return Results.NotFound();

        var triggers = await scheduler.GetTriggersOfJob(jobKey, ct);
        foreach (var trigger in triggers)
            await scheduler.ResumeTrigger(trigger.Key, ct);

        return Results.Ok(new { resumed = true });
    }

    private static async Task<IResult> HandleUpdateJobSchedule(
        string name,
        UpdateScheduleRequest request,
        ISchedulerFactory schedulerFactory,
        CancellationToken ct = default
    )
    {
        if (!CronExpression.IsValidExpression(request.CronExpression))
            return Results.BadRequest(new { error = "Invalid cron expression." });

        var scheduler = await schedulerFactory.GetScheduler(ct);
        var jobKey = await FindJobKeyByNameAsync(scheduler, name, ct);
        if (jobKey is null) return Results.NotFound();

        var triggers = await scheduler.GetTriggersOfJob(jobKey, ct);
        var oldTrigger = triggers.FirstOrDefault();
        if (oldTrigger is null) return Results.NotFound();

        var newTrigger = TriggerBuilder.Create()
            .WithIdentity(oldTrigger.Key)
            .ForJob(jobKey)
            .WithCronSchedule(request.CronExpression)
            .Build();

        var nextFire = await scheduler.RescheduleJob(oldTrigger.Key, newTrigger, ct);

        return Results.Ok(new { cronExpression = request.CronExpression, nextFireTimeUtc = nextFire?.UtcDateTime });
    }

    private static async Task<JobKey?> FindJobKeyByNameAsync(
        IScheduler scheduler, string name, CancellationToken ct)
    {
        var allKeys = await scheduler.GetJobKeys(GroupMatcher<JobKey>.AnyGroup(), ct);
        return allKeys.FirstOrDefault(k => k.Name == name);
    }
}

// ── Request/Response records ──
record UpdateScheduleRequest(string CronExpression);
