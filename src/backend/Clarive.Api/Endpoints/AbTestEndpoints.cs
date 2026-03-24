using Clarive.AI.Orchestration;
using Clarive.Api.Helpers;
using Clarive.Application.AbTests.Contracts;

namespace Clarive.Api.Endpoints;

public static class AbTestEndpoints
{
    public static RouteGroupBuilder MapAbTestEndpoints(this IEndpointRouteBuilder app)
    {
        var group = app
            .MapGroup("/api/entries/{entryId:guid}/abtests")
            .WithTags("A/B Tests")
            .RequireAuthorization();

        group
            .MapPost("/", HandleRun)
            .RequireAuthorization("EditorOrAdmin")
            .RequireRateLimiting("auth")
            .AddEndpointFilter(AiConfiguredFilter);

        group.MapGet("/", HandleList);
        group.MapGet("/{runId:guid}", HandleGet);
        group.MapDelete("/{runId:guid}", HandleDelete).RequireAuthorization("EditorOrAdmin");

        return group;
    }

    private static async ValueTask<object?> AiConfiguredFilter(
        EndpointFilterInvocationContext ctx,
        EndpointFilterDelegate next
    )
    {
        var orchestrator = ctx.HttpContext.RequestServices.GetRequiredService<IPromptOrchestrator>();
        if (!orchestrator.IsConfigured)
            return ctx.HttpContext.ErrorResult(
                503,
                "AI_NOT_CONFIGURED",
                "AI is not configured. Ask an admin to set up an AI provider."
            );
        return await next(ctx);
    }

    private static bool WantsSse(HttpContext ctx) =>
        ctx.Request.Headers.Accept.Any(h => h?.Contains("text/event-stream") == true);

    private static async Task<IResult> HandleRun(
        Guid entryId,
        HttpContext ctx,
        StartAbTestRequest request,
        IAbTestService service,
        CancellationToken ct)
    {
        if (Validator.ValidateRequest(request) is { } validationErr)
            return validationErr;

        var tenantId = ctx.GetTenantId();
        var userId = ctx.GetUserId();

        if (!WantsSse(ctx))
        {
            var result = await service.RunAsync(tenantId, userId, entryId, request, null, ct);
            if (result.IsError)
                return result.Errors.ToHttpResult(ctx);

            return Results.Created($"/api/entries/{entryId}/abtests/{result.Value.Id}", result.Value);
        }

        // SSE streaming path
        var sse = new SseProgressWriter(ctx.Response);
        await sse.InitAsync(ct);

        try
        {
            var result = await service.RunAsync(
                tenantId, userId, entryId, request,
                evt => sse.WriteChunkAsync(evt, ct),
                ct
            );

            if (result.IsError)
                await sse.WriteErrorAsync(result.FirstError.Code, result.FirstError.Description, ct);
            else
                await sse.WriteDoneAsync(result.Value, ct);
        }
        catch (Exception ex) when (ex is not OperationCanceledException)
        {
            await sse.WriteErrorAsync("AB_TEST_FAILED", "A/B test execution failed.", ct);
        }

        return Results.Empty;
    }

    private static async Task<IResult> HandleList(
        Guid entryId,
        HttpContext ctx,
        IAbTestService service,
        CancellationToken ct)
    {
        var tenantId = ctx.GetTenantId();
        var result = await service.ListAsync(tenantId, entryId, ct);

        if (result.IsError)
            return result.Errors.ToHttpResult(ctx);

        return Results.Ok(result.Value);
    }

    private static async Task<IResult> HandleGet(
        Guid entryId,
        Guid runId,
        HttpContext ctx,
        IAbTestService service,
        CancellationToken ct)
    {
        var tenantId = ctx.GetTenantId();
        var result = await service.GetAsync(tenantId, entryId, runId, ct);

        if (result.IsError)
            return result.Errors.ToHttpResult(ctx);

        return Results.Ok(result.Value);
    }

    private static async Task<IResult> HandleDelete(
        Guid entryId,
        Guid runId,
        HttpContext ctx,
        IAbTestService service,
        CancellationToken ct)
    {
        var tenantId = ctx.GetTenantId();
        var result = await service.DeleteAsync(tenantId, entryId, runId, ct);

        if (result.IsError)
            return result.Errors.ToHttpResult(ctx);

        return Results.NoContent();
    }
}
