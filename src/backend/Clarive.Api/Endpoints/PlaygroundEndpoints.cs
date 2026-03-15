using Clarive.Api.Auth;
using Clarive.Api.Helpers;
using Clarive.Api.Models.Requests;
using Clarive.Api.Models.Responses;
using Clarive.Api.Services;
using Clarive.Api.Services.Agents;

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

        group.MapGet("/entries/{entryId:guid}/test-runs", HandleGetTestRuns);

        group.MapGet("/ai/models", HandleGetModels)
            .AddEndpointFilter(AiConfiguredFilter);

        group.MapGet("/ai/available-models", HandleGetEnrichedModels);

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
        PlaygroundService playground,
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

    // ── Get Test Runs ──

    private static async Task<IResult> HandleGetTestRuns(
        Guid entryId,
        HttpContext ctx,
        PlaygroundService playground,
        CancellationToken ct)
    {
        var tenantId = ctx.GetTenantId();
        var runs = await playground.GetTestRunsAsync(tenantId, entryId, ct);
        return Results.Ok(runs);
    }

    // ── Get Enriched Models (with provider metadata) ──

    private static async Task<IResult> HandleGetEnrichedModels(
        HttpContext ctx,
        PlaygroundService playground,
        CancellationToken ct)
    {
        var result = await playground.GetEnrichedModelsAsync(ct);

        if (result.IsError)
            return result.Errors.ToHttpResult(ctx);

        return Results.Ok(new EnrichedModelsListResponse(result.Value));
    }

    // ── Get Available Models (legacy) ──

    private static async Task<IResult> HandleGetModels(
        HttpContext ctx,
        PlaygroundService playground,
        CancellationToken ct)
    {
        var result = await playground.GetAvailableModelsAsync(ct);

        if (result.IsError)
            return result.Errors.ToHttpResult(ctx);

        return Results.Ok(new AvailableModelsResponse(result.Value));
    }
}
