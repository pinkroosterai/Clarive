using Clarive.Api.Auth;
using Clarive.Api.Helpers;
using Clarive.Api.Models.Requests;
using Clarive.Api.Models.Responses;
using Clarive.Api.Services;
using Clarive.Api.Services.Agents;
using Clarive.Api.Services.Interfaces;

namespace Clarive.Api.Endpoints;

public static class PlaygroundEndpoints
{
    public static RouteGroupBuilder MapPlaygroundEndpoints(this IEndpointRouteBuilder app)
    {
        var group = app.MapGroup("/api")
            .WithTags("Playground")
            .RequireAuthorization("EditorOrAdmin");

        group.MapPost("/entries/{entryId:guid}/test", HandleTest)
            .RequireRateLimiting("auth")
            .AddEndpointFilter(AiConfiguredFilter);

        group.MapPost("/entries/{entryId:guid}/runs/{runId:guid}/judge", HandleJudgeRun)
            .RequireRateLimiting("auth")
            .AddEndpointFilter(AiConfiguredFilter);

        group.MapGet("/ai/models", HandleGetModels)
            .AddEndpointFilter(AiConfiguredFilter);

        group.MapGet("/ai/available-models", HandleGetEnrichedModels)
            .AddEndpointFilter(AiConfiguredFilter);

        // Test runs are read-only — allow any authenticated user (including viewers)
        app.MapGet("/api/entries/{entryId:guid}/test-runs", HandleGetTestRuns)
            .WithTags("Playground")
            .RequireAuthorization();

        return group;
    }

    private static async ValueTask<object?> AiConfiguredFilter(
        EndpointFilterInvocationContext ctx, EndpointFilterDelegate next)
    {
        var orchestrator = ctx.HttpContext.RequestServices
            .GetRequiredService<IPromptOrchestrator>();
        if (!orchestrator.IsConfigured)
            return ctx.HttpContext.ErrorResult(503, "AI_NOT_CONFIGURED",
                "AI features are not configured.");
        return await next(ctx);
    }

    private static bool WantsSse(HttpContext ctx) =>
        ctx.Request.Headers.Accept.Any(h => h?.Contains("text/event-stream") == true);

    // ── Test Entry ──

    private static async Task<IResult> HandleTest(
        Guid entryId,
        HttpContext ctx,
        TestEntryRequest request,
        IPlaygroundService playground,
        CancellationToken ct)
    {
        if (Validator.ValidateRequest(request) is { } validationErr)
            return validationErr;

        var tenantId = ctx.GetTenantId();
        var userId = ctx.GetUserId();

        if (!WantsSse(ctx))
        {
            var result = await playground.TestEntryAsync(
                tenantId, userId, entryId, request, ct);

            if (result.IsError)
                return result.Errors.ToHttpResult(ctx, "Entry", entryId.ToString());

            return Results.Ok(result.Value);
        }

        // SSE streaming path
        var sse = new SseProgressWriter(ctx.Response);
        await sse.InitAsync(ct);

        try
        {
            var result = await playground.TestEntryAsync(
                tenantId, userId, entryId, request, ct,
                chunk => sse.WriteChunkAsync(chunk, ct));

            if (result.IsError)
            {
                await sse.WriteErrorAsync(
                    result.FirstError.Code, result.FirstError.Description, ct);
            }
            else
            {
                await sse.WriteDoneAsync(result.Value, ct);
            }
        }
        catch (Exception ex) when (ex is not OperationCanceledException)
        {
            await sse.WriteErrorAsync("TEST_FAILED", "Playground test failed.", ct);
        }

        return Results.Empty;
    }

    // ── Judge Run ──

    private static async Task<IResult> HandleJudgeRun(
        Guid entryId,
        Guid runId,
        HttpContext ctx,
        IPlaygroundService playground,
        CancellationToken ct)
    {
        var tenantId = ctx.GetTenantId();
        var userId = ctx.GetUserId();

        var result = await playground.JudgePlaygroundRunAsync(
            tenantId, userId, entryId, runId, ct);

        if (result.IsError)
            return result.Errors.ToHttpResult(ctx, "Run", runId.ToString());

        return Results.Ok(result.Value);
    }

    // ── Get Test Runs ──

    private static async Task<IResult> HandleGetTestRuns(
        Guid entryId,
        HttpContext ctx,
        IPlaygroundRunService runService,
        CancellationToken ct)
    {
        var runs = await runService.GetRunsAsync(entryId, ct);
        return Results.Ok(runs);
    }

    // ── Get Enriched Models (with provider metadata) ──

    private static async Task<IResult> HandleGetEnrichedModels(
        HttpContext ctx,
        IModelResolutionService modelResolution,
        CancellationToken ct)
    {
        var result = await modelResolution.GetEnrichedModelsAsync(ct);

        if (result.IsError)
            return result.Errors.ToHttpResult(ctx);

        return Results.Ok(new EnrichedModelsListResponse(result.Value));
    }

    // ── Get Available Models (legacy) ──

    private static async Task<IResult> HandleGetModels(
        HttpContext ctx,
        IModelResolutionService modelResolution,
        CancellationToken ct)
    {
        var result = await modelResolution.GetAvailableModelsAsync(ct);

        if (result.IsError)
            return result.Errors.ToHttpResult(ctx);

        return Results.Ok(new AvailableModelsResponse(result.Value));
    }
}
