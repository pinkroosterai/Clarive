using Clarive.Domain.Entities;
using Clarive.Core.Helpers;
using Clarive.Core.Helpers;
using Clarive.Core.Models.Requests;
using Clarive.Domain.ValueObjects;
using Clarive.Domain.Interfaces.Repositories;
using Clarive.Core.Services;
using Clarive.Core.Services.Interfaces;

namespace Clarive.Core.Endpoints;

public static class TenantEndpoints
{
    public static RouteGroupBuilder MapTenantEndpoints(this IEndpointRouteBuilder app)
    {
        var group = app.MapGroup("/api/tenant").WithTags("Tenant").RequireAuthorization();

        group.MapGet("/", HandleGet);

        group.MapPatch("/", HandleUpdate).RequireAuthorization("AdminOnly");

        group
            .MapPost("/avatar", HandleUploadAvatar)
            .RequireAuthorization("AdminOnly")
            .DisableAntiforgery();

        group.MapDelete("/avatar", HandleDeleteAvatar).RequireAuthorization("AdminOnly");

        // Public endpoint for serving tenant avatars (separate route group, no auth)
        app.MapGet("/api/tenants/{tenantId:guid}/avatar", HandleServeAvatar).WithTags("Tenant");

        return group;
    }

    private static async Task<IResult> HandleGet(
        HttpContext ctx,
        ITenantRepository tenantRepo,
        CancellationToken ct
    )
    {
        var tenantId = ctx.GetTenantId();
        var tenant = await tenantRepo.GetByIdAsync(tenantId, ct);

        if (tenant is null)
            return ctx.ErrorResult(404, "NOT_FOUND", "Tenant not found.");

        return Results.Ok(
            new
            {
                tenant.Id,
                tenant.Name,
                AvatarUrl = TenantAvatarUrl(tenant),
            }
        );
    }

    private static async Task<IResult> HandleUpdate(
        HttpContext ctx,
        UpdateTenantRequest request,
        ITenantRepository tenantRepo,
        CancellationToken ct
    )
    {
        var tenantId = ctx.GetTenantId();

        if (Validator.ValidateRequest(request) is { } validationErr)
            return validationErr;

        var tenant = await tenantRepo.GetByIdAsync(tenantId, ct);
        if (tenant is null)
            return ctx.ErrorResult(404, "NOT_FOUND", "Tenant not found.");

        tenant.Name = request.Name.Trim();
        await tenantRepo.UpdateAsync(tenant, ct);

        return Results.Ok(
            new
            {
                tenant.Id,
                tenant.Name,
                AvatarUrl = TenantAvatarUrl(tenant),
            }
        );
    }

    private static async Task<IResult> HandleUploadAvatar(
        HttpContext ctx,
        ITenantRepository tenantRepo,
        IAvatarService avatarService,
        CancellationToken ct
    )
    {
        var tenantId = ctx.GetTenantId();
        var tenant = await tenantRepo.GetByIdAsync(tenantId, ct);

        if (tenant is null)
            return ctx.ErrorResult(404, "NOT_FOUND", "Tenant not found.");

        var (file, validationError) = AvatarHelpers.ValidateUpload(ctx);
        if (validationError is not null)
            return validationError;

        try
        {
            await using var stream = file!.OpenReadStream();
            var relativePath = await avatarService.SaveTenantAvatarAsync(
                tenantId,
                stream,
                file.ContentType,
                ct
            );

            tenant.AvatarPath = relativePath;
            await tenantRepo.UpdateAsync(tenant, ct);

            return Results.Ok(new { avatarUrl = AvatarHelpers.TenantAvatarUrl(tenant) });
        }
        catch (InvalidOperationException ex)
        {
            return ctx.ErrorResult(422, "VALIDATION_ERROR", ex.Message);
        }
    }

    private static async Task<IResult> HandleDeleteAvatar(
        HttpContext ctx,
        ITenantRepository tenantRepo,
        IAvatarService avatarService,
        CancellationToken ct
    )
    {
        var tenantId = ctx.GetTenantId();
        var tenant = await tenantRepo.GetByIdAsync(tenantId, ct);

        if (tenant is null)
            return ctx.ErrorResult(404, "NOT_FOUND", "Tenant not found.");

        await avatarService.DeleteTenantAvatarAsync(tenantId, ct);
        tenant.AvatarPath = null;
        await tenantRepo.UpdateAsync(tenant, ct);

        return Results.NoContent();
    }

    private static async Task<IResult> HandleServeAvatar(
        Guid tenantId,
        ITenantRepository tenantRepo,
        IAvatarService avatarService,
        CancellationToken ct
    )
    {
        var tenant = await tenantRepo.GetByIdAsync(tenantId, ct);
        if (tenant is null)
            return Results.NotFound();

        var absolutePath = avatarService.GetAbsolutePath(tenant.AvatarPath);
        if (absolutePath is null)
            return Results.NotFound();

        return Results.File(absolutePath, "image/webp");
    }

    internal static string? TenantAvatarUrl(Tenant tenant) =>
        AvatarHelpers.TenantAvatarUrl(tenant);
}
