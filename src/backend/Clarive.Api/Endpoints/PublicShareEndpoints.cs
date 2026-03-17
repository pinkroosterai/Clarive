using Clarive.Api.Helpers;
using Clarive.Api.Services.Interfaces;

namespace Clarive.Api.Endpoints;

public static class PublicShareEndpoints
{
    public static RouteGroupBuilder MapPublicShareEndpoints(this IEndpointRouteBuilder app)
    {
        var group = app.MapGroup("/share")
            .WithTags("Public Share")
            .AllowAnonymous()
            .RequireRateLimiting("auth");

        group.MapGet("/{token}", HandleGet);
        group.MapPost("/{token}/verify", HandleVerify);

        return group;
    }

    private record VerifyPasswordRequest(string Password);

    private static async Task<IResult> HandleGet(
        string token,
        HttpContext ctx,
        IShareLinkService shareLinkService,
        CancellationToken ct)
    {
        var result = await shareLinkService.GetPublicEntryByTokenAsync(token, ct);
        if (result.IsError)
            return result.Errors.ToHttpResult(ctx);

        var entry = result.Value;

        if (entry.PasswordRequired)
            return Results.Json(new { passwordRequired = true }, statusCode: 403);

        return Results.Ok(new
        {
            entry.EntryId,
            entry.Title,
            entry.SystemMessage,
            entry.Version,
            entry.PublishedAt,
            entry.Prompts
        });
    }

    private static async Task<IResult> HandleVerify(
        string token,
        HttpContext ctx,
        VerifyPasswordRequest request,
        IShareLinkService shareLinkService,
        CancellationToken ct)
    {
        if (string.IsNullOrWhiteSpace(request.Password))
            return ctx.ErrorResult(422, "VALIDATION_ERROR", "Password is required.");

        var result = await shareLinkService.VerifyPasswordAndGetEntryAsync(token, request.Password, ct);
        if (result.IsError)
            return result.Errors.ToHttpResult(ctx);

        var entry = result.Value;
        return Results.Ok(new
        {
            entry.EntryId,
            entry.Title,
            entry.SystemMessage,
            entry.Version,
            entry.PublishedAt,
            entry.Prompts
        });
    }
}
