using Clarive.AI.Agents;
using Clarive.AI.Orchestration;
using Clarive.Api.Helpers;
using Clarive.Domain.ValueObjects;

namespace Clarive.Api.Endpoints;

public static class AiGenerationEndpoints
{
    public static RouteGroupBuilder MapAiGenerationEndpoints(this IEndpointRouteBuilder app)
    {
        var group = app.MapGroup("/api/ai")
            .WithTags("AI Generation")
            .RequireAuthorization("EditorOrAdmin")
            .RequireRateLimiting("auth")
            .AddEndpointFilter(
                async (ctx, next) =>
                {
                    var orchestrator =
                        ctx.HttpContext.RequestServices.GetRequiredService<IPromptOrchestrator>();
                    if (!orchestrator.IsConfigured)
                        return ctx.HttpContext.ErrorResult(
                            503,
                            "AI_NOT_CONFIGURED",
                            "AI features are not configured."
                        );
                    return await next(ctx);
                }
            );

        group.MapPost("/generate", HandleGenerate);
        group.MapPost("/refine", HandleRefine);
        group.MapPost("/enhance", HandleEnhance);
        group.MapPost("/generate-system-message", HandleGenerateSystemMessage);
        group.MapPost("/decompose", HandleDecompose);
        group.MapPost("/fill-template-fields", HandleFillTemplateFields);
        group.MapPost("/polish-description", HandlePolishDescription);
        group.MapPost("/evaluate", HandleEvaluate);
        group.MapPost("/resolve-merge-conflict", HandleResolveMergeConflict);

        return group;
    }

    private static bool WantsSse(HttpContext ctx) =>
        ctx.Request.Headers.Accept.Any(h => h?.Contains("text/event-stream") == true);

    // ── Generate ──

    private static async Task<IResult> HandleGenerate(
        HttpContext ctx,
        GeneratePromptRequest request,
        IAiGenerationService aiService,
        ILoggerFactory loggerFactory,
        CancellationToken ct
    )
    {
        if (Validator.ValidateRequest(request) is { } validationErr)
            return validationErr;

        if (!WantsSse(ctx))
        {
            var result = await aiService.GenerateAsync(
                ctx.GetTenantId(),
                ctx.GetUserId(),
                request,
                ct
            );
            return Results.Ok(ToResponse(result));
        }

        // SSE path
        var logger = loggerFactory.CreateLogger("Clarive.Api.Endpoints.AiGenerationEndpoints");
        var sse = new SseProgressWriter(ctx.Response);
        await sse.InitAsync(ct);

        try
        {
            var result = await aiService.GenerateAsync(
                ctx.GetTenantId(),
                ctx.GetUserId(),
                request,
                ct,
                progress => sse.WriteProgressAsync(progress, ct)
            );

            await sse.WriteDoneAsync(ToResponse(result), ct);
        }
        catch (InvalidOperationException ex) when (ex.Message.Contains("expired"))
        {
            await sse.WriteErrorAsync(
                "SESSION_EXPIRED",
                "Agent session expired. Please start a new generation.",
                ct
            );
        }
        catch (InvalidOperationException ex) when (ex.Message.Contains("Web search"))
        {
            logger.LogWarning(ex, "Web search unavailable during generation");
            await sse.WriteErrorAsync("WEB_SEARCH_UNAVAILABLE", ex.Message, ct);
        }
        catch (Exception ex) when (ex is not OperationCanceledException)
        {
            logger.LogError(ex, "AI generation failed");
            await sse.WriteErrorAsync("GENERATION_FAILED", "Generation failed.", ct);
        }

        return Results.Empty;
    }

    // ── Refine ──

    private static async Task<IResult> HandleRefine(
        HttpContext ctx,
        RefinePromptRequest request,
        IAiGenerationService aiService,
        CancellationToken ct
    )
    {
        if (request.Answers?.Any(a => a.Answer.Length > 1000) == true)
            return ctx.ErrorResult(
                422,
                "VALIDATION_ERROR",
                "Each answer must not exceed 1000 characters."
            );

        if (!WantsSse(ctx))
        {
            try
            {
                var result = await aiService.RefineAsync(
                    ctx.GetTenantId(),
                    ctx.GetUserId(),
                    request,
                    ct
                );

                if (result.IsError)
                    return result.Errors.ToHttpResult(ctx);

                return Results.Ok(ToResponse(result.Value));
            }
            catch (InvalidOperationException ex) when (ex.Message.Contains("expired"))
            {
                return ctx.ErrorResult(
                    410,
                    "SESSION_EXPIRED",
                    "Agent session expired. Please start a new generation."
                );
            }
        }

        // SSE path
        var sse = new SseProgressWriter(ctx.Response);
        await sse.InitAsync(ct);

        try
        {
            var result = await aiService.RefineAsync(
                ctx.GetTenantId(),
                ctx.GetUserId(),
                request,
                ct,
                progress => sse.WriteProgressAsync(progress, ct)
            );

            if (result.IsError)
            {
                await sse.WriteErrorAsync(
                    result.FirstError.Code,
                    result.FirstError.Description,
                    ct
                );
            }
            else
            {
                await sse.WriteDoneAsync(ToResponse(result.Value), ct);
            }
        }
        catch (InvalidOperationException ex) when (ex.Message.Contains("expired"))
        {
            await sse.WriteErrorAsync(
                "SESSION_EXPIRED",
                "Agent session expired. Please start a new generation.",
                ct
            );
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
        CancellationToken ct
    )
    {
        var tenantId = ctx.GetTenantId();
        var userId = ctx.GetUserId();

        if (!WantsSse(ctx))
        {
            var result = await aiService.EnhanceAsync(tenantId, userId, request.EntryId, request.TabId, ct);

            if (result.IsError)
                return result.Errors.ToHttpResult(ctx, "Entry", request.EntryId.ToString());

            return Results.Ok(ToResponse(result.Value));
        }

        // SSE path
        var sse = new SseProgressWriter(ctx.Response);
        await sse.InitAsync(ct);

        try
        {
            var result = await aiService.EnhanceAsync(
                tenantId,
                userId,
                request.EntryId,
                request.TabId,
                ct,
                progress => sse.WriteProgressAsync(progress, ct)
            );

            if (result.IsError)
            {
                await sse.WriteErrorAsync(
                    result.FirstError.Code,
                    result.FirstError.Description,
                    ct
                );
            }
            else
            {
                await sse.WriteDoneAsync(ToResponse(result.Value), ct);
            }
        }
        catch (InvalidOperationException ex) when (ex.Message.Contains("expired"))
        {
            await sse.WriteErrorAsync(
                "SESSION_EXPIRED",
                "Agent session expired. Please start a new generation.",
                ct
            );
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
        IAiUtilityService aiUtilityService,
        CancellationToken ct
    )
    {
        var tenantId = ctx.GetTenantId();
        var userId = ctx.GetUserId();

        var result = await aiUtilityService.GenerateSystemMessageAsync(
            tenantId,
            userId,
            request.EntryId,
            request.TabId,
            ct
        );
        if (result.IsError)
            return result.Errors.ToHttpResult(ctx, "Entry", request.EntryId.ToString());

        return Results.Ok(new GenerateSystemMessageResponse(result.Value));
    }

    // ── Decompose (no SSE — fast single-turn) ──

    private static async Task<IResult> HandleDecompose(
        HttpContext ctx,
        DecomposeRequest request,
        IAiUtilityService aiUtilityService,
        CancellationToken ct
    )
    {
        var tenantId = ctx.GetTenantId();
        var userId = ctx.GetUserId();

        var result = await aiUtilityService.DecomposeAsync(tenantId, userId, request.EntryId, request.TabId, ct);
        if (result.IsError)
            return result.Errors.ToHttpResult(ctx, "Entry", request.EntryId.ToString());

        return Results.Ok(new DecomposeResponse(result.Value));
    }

    // ── Fill template fields (no SSE — fast single-turn) ──

    private static async Task<IResult> HandleFillTemplateFields(
        HttpContext ctx,
        FillTemplateFieldsRequest request,
        IAiUtilityService aiUtilityService,
        CancellationToken ct
    )
    {
        var tenantId = ctx.GetTenantId();
        var userId = ctx.GetUserId();

        var result = await aiUtilityService.FillTemplateFieldsAsync(tenantId, userId, request.EntryId, request.TabId, ct);
        if (result.IsError)
            return result.Errors.ToHttpResult(ctx, "Entry", request.EntryId.ToString());

        return Results.Ok(new FillTemplateFieldsResponse(result.Value));
    }

    private static GeneratePromptResponse ToResponse(AiGenerationResult result) =>
        new(
            result.SessionId,
            result.Draft,
            result.Questions,
            result.Enhancements,
            result.Evaluation,
            result.ScoreHistory
        );

    // ── Evaluate (no SSE — single-turn) ──

    private static async Task<IResult> HandleEvaluate(
        HttpContext ctx,
        EvaluateEntryRequest request,
        IAiUtilityService aiUtilityService,
        CancellationToken ct
    )
    {
        if (Validator.ValidateRequest(request) is { } validationErr)
            return validationErr;

        var result = await aiUtilityService.EvaluateAsync(
            ctx.GetTenantId(),
            ctx.GetUserId(),
            request,
            ct
        );

        return result.IsError
            ? result.Errors.ToHttpResult(ctx)
            : Results.Ok(result.Value);
    }

    private record PolishDescriptionRequest(string Description);

    private static async Task<IResult> HandlePolishDescription(
        HttpContext ctx,
        PolishDescriptionRequest request,
        IAiUtilityService aiUtilityService
    )
    {
        var tenantId = ctx.GetTenantId();
        var userId = ctx.GetUserId();

        var result = await aiUtilityService.PolishDescriptionAsync(
            tenantId,
            userId,
            request.Description,
            ctx.RequestAborted
        );

        return result.IsError
            ? result.Errors.ToHttpResult(ctx)
            : Results.Ok(new { polished = result.Value });
    }

    // ── Resolve merge conflict ──

    private record ResolveMergeConflictRequest(string FieldName, string VersionA, string VersionB);

    private static async Task<IResult> HandleResolveMergeConflict(
        HttpContext ctx,
        ResolveMergeConflictRequest request,
        IAiUtilityService aiUtilityService
    )
    {
        var tenantId = ctx.GetTenantId();
        var userId = ctx.GetUserId();

        var result = await aiUtilityService.ResolveMergeConflictAsync(
            tenantId,
            userId,
            request.FieldName,
            request.VersionA,
            request.VersionB,
            ctx.RequestAborted
        );

        return result.IsError
            ? result.Errors.ToHttpResult(ctx)
            : Results.Ok(new { mergedText = result.Value });
    }
}
