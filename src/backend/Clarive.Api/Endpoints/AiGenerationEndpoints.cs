using Clarive.Api.Helpers;
using Clarive.Api.Models.Requests;
using Clarive.Api.Models.Responses;
using Clarive.Api.Models.Results;
using Clarive.Api.Services.Agents;
using Clarive.Api.Services.Agents.AiExtensions;
using Clarive.Api.Services.Interfaces;
using Clarive.Api.Auth;

namespace Clarive.Api.Endpoints;

public static class AiGenerationEndpoints
{
    public static RouteGroupBuilder MapAiGenerationEndpoints(this IEndpointRouteBuilder app)
    {
        var group = app.MapGroup("/api/ai")
            .WithTags("AI Generation")
            .RequireAuthorization("EditorOrAdmin")
            .RequireRateLimiting("auth")
            .AddEndpointFilter(async (ctx, next) =>
            {
                var orchestrator = ctx.HttpContext.RequestServices.GetRequiredService<IPromptOrchestrator>();
                if (!orchestrator.IsConfigured)
                    return ctx.HttpContext.ErrorResult(503, "AI_NOT_CONFIGURED", "AI features are not configured.");
                return await next(ctx);
            });

        group.MapPost("/generate", HandleGenerate);
        group.MapPost("/refine", HandleRefine);
        group.MapPost("/enhance", HandleEnhance);
        group.MapPost("/generate-system-message", HandleGenerateSystemMessage);
        group.MapPost("/decompose", HandleDecompose);

        return group;
    }

    private static bool WantsSse(HttpContext ctx) =>
        ctx.Request.Headers.Accept.Any(h => h?.Contains("text/event-stream") == true);

    // ── Generate ──

    private static async Task<IResult> HandleGenerate(
        HttpContext ctx,
        GeneratePromptRequest request,
        IAiGenerationService aiService,
        CancellationToken ct)
    {
        if (string.IsNullOrWhiteSpace(request.Description))
            return ctx.ErrorResult(422, "VALIDATION_ERROR", "Description is required.");

        if (request.Description.Length > 2000)
            return ctx.ErrorResult(422, "VALIDATION_ERROR", "Description must not exceed 2000 characters.");

        if (!WantsSse(ctx))
        {
            var result = await aiService.GenerateAsync(ctx.GetTenantId(), request, ct);
            return Results.Ok(ToResponse(result));
        }

        // SSE path
        var sse = new SseProgressWriter(ctx.Response);
        await sse.InitAsync(ct);

        try
        {
            var result = await aiService.GenerateAsync(
                ctx.GetTenantId(), request, ct,
                progress => sse.WriteProgressAsync(progress, ct));

            await sse.WriteDoneAsync(ToResponse(result), ct);
        }
        catch (Exception ex) when (ex is not OperationCanceledException)
        {
            await sse.WriteErrorAsync("GENERATION_FAILED", "Generation failed.", ct);
        }

        return Results.Empty;
    }

    // ── Refine ──

    private static async Task<IResult> HandleRefine(
        HttpContext ctx,
        RefinePromptRequest request,
        IAiGenerationService aiService,
        CancellationToken ct)
    {
        if (request.Answers?.Any(a => a.Answer.Length > 1000) == true)
            return ctx.ErrorResult(422, "VALIDATION_ERROR", "Each answer must not exceed 1000 characters.");

        if (!WantsSse(ctx))
        {
            try
            {
                var (result, errorCode, errorMessage) = await aiService.RefineAsync(ctx.GetTenantId(), request, ct);

                if (result is null)
                {
                    var statusCode = errorCode == "NOT_FOUND" ? 404 : 422;
                    return ctx.ErrorResult(statusCode, errorCode!, errorMessage!);
                }

                return Results.Ok(ToResponse(result));
            }
            catch (InvalidOperationException ex) when (ex.Message.Contains("expired"))
            {
                return ctx.ErrorResult(410, "SESSION_EXPIRED", "Agent session expired. Please start a new generation.");
            }
        }

        // SSE path
        var sse = new SseProgressWriter(ctx.Response);
        await sse.InitAsync(ct);

        try
        {
            var (result, errorCode, errorMessage) = await aiService.RefineAsync(
                ctx.GetTenantId(), request, ct,
                progress => sse.WriteProgressAsync(progress, ct));

            if (result is null)
            {
                await sse.WriteErrorAsync(errorCode!, errorMessage!, ct);
            }
            else
            {
                await sse.WriteDoneAsync(ToResponse(result), ct);
            }
        }
        catch (InvalidOperationException ex) when (ex.Message.Contains("expired"))
        {
            await sse.WriteErrorAsync("SESSION_EXPIRED", "Agent session expired. Please start a new generation.", ct);
        }
        catch (Exception ex) when (ex is not OperationCanceledException)
        {
            await sse.WriteErrorAsync("REFINEMENT_FAILED", "Refinement failed.", ct);
        }

        return Results.Empty;
    }

    // ── Enhance ──

    private static async Task<IResult> HandleEnhance(
        HttpContext ctx,
        EnhanceRequest request,
        IAiGenerationService aiService,
        CancellationToken ct)
    {
        var tenantId = ctx.GetTenantId();

        if (!WantsSse(ctx))
        {
            var (result, errorCode, errorMessage) = await aiService.EnhanceAsync(tenantId, request.EntryId, ct);

            if (result is null)
            {
                var statusCode = errorCode == "NOT_FOUND" ? 404 : 409;
                return ctx.ErrorResult(statusCode, errorCode!, errorMessage!, "Entry", request.EntryId.ToString());
            }

            return Results.Ok(ToResponse(result));
        }

        // SSE path
        var sse = new SseProgressWriter(ctx.Response);
        await sse.InitAsync(ct);

        try
        {
            var (result, errorCode, errorMessage) = await aiService.EnhanceAsync(
                tenantId, request.EntryId, ct,
                progress => sse.WriteProgressAsync(progress, ct));

            if (result is null)
            {
                await sse.WriteErrorAsync(errorCode!, errorMessage!, ct);
            }
            else
            {
                await sse.WriteDoneAsync(ToResponse(result), ct);
            }
        }
        catch (Exception ex) when (ex is not OperationCanceledException)
        {
            await sse.WriteErrorAsync("ENHANCE_FAILED", "Enhancement failed.", ct);
        }

        return Results.Empty;
    }

    // ── Generate system message (no SSE — fast single-turn) ──

    private static async Task<IResult> HandleGenerateSystemMessage(
        HttpContext ctx,
        GenerateSystemMessageRequest request,
        IAiGenerationService aiService,
        CancellationToken ct)
    {
        var tenantId = ctx.GetTenantId();

        var (systemMessage, errorCode, errorMessage) = await aiService.GenerateSystemMessageAsync(tenantId, request.EntryId, ct);
        if (systemMessage is null)
        {
            var statusCode = errorCode switch { "NOT_FOUND" => 404, "ALREADY_EXISTS" => 409, _ => 422 };
            return ctx.ErrorResult(statusCode, errorCode!, errorMessage!, "Entry", request.EntryId.ToString());
        }

        return Results.Ok(new GenerateSystemMessageResponse(systemMessage));
    }

    // ── Decompose (no SSE — fast single-turn) ──

    private static async Task<IResult> HandleDecompose(
        HttpContext ctx,
        DecomposeRequest request,
        IAiGenerationService aiService,
        CancellationToken ct)
    {
        var tenantId = ctx.GetTenantId();

        var (prompts, errorCode, errorMessage) = await aiService.DecomposeAsync(tenantId, request.EntryId, ct);
        if (prompts is null)
        {
            var statusCode = errorCode switch { "NOT_FOUND" => 404, "ALREADY_CHAIN" => 409, _ => 422 };
            return ctx.ErrorResult(statusCode, errorCode!, errorMessage!, "Entry", request.EntryId.ToString());
        }

        return Results.Ok(new DecomposeResponse(prompts));
    }

    private static GeneratePromptResponse ToResponse(AiGenerationResult result) =>
        new(result.SessionId, result.Draft, result.Questions, result.Enhancements,
            result.Evaluation, result.ScoreHistory);
}
