using System.Net;
using Clarive.Api.Helpers;
using Clarive.Application.McpServers.Contracts;

namespace Clarive.Api.Endpoints;

public static class McpServerEndpoints
{
    public static RouteGroupBuilder MapMcpServerEndpoints(this IEndpointRouteBuilder app)
    {
        var group = app
            .MapGroup("/api/mcp-servers")
            .WithTags("MCP Servers")
            .RequireAuthorization("EditorOrAdmin");

        group.MapGet("/", HandleList);
        group.MapPost("/", HandleCreate);
        group.MapPatch("/{serverId:guid}", HandleUpdate);
        group.MapDelete("/{serverId:guid}", HandleDelete);
        group.MapPost("/{serverId:guid}/sync", HandleSync);

        return group;
    }

    private static async Task<IResult> HandleList(
        HttpContext ctx,
        IMcpServerService service,
        CancellationToken ct
    )
    {
        var tenantId = ctx.GetTenantId();
        var servers = await service.ListAsync(tenantId, ct);
        return Results.Ok(new { items = servers });
    }

    private static async Task<IResult> HandleCreate(
        HttpContext ctx,
        CreateMcpServerRequest request,
        IMcpServerService service,
        CancellationToken ct
    )
    {
        var tenantId = ctx.GetTenantId();

        if (string.IsNullOrWhiteSpace(request.Name))
            return ctx.ErrorResult(422, "VALIDATION_ERROR", "Name is required.");

        if (string.IsNullOrWhiteSpace(request.Url))
            return ctx.ErrorResult(422, "VALIDATION_ERROR", "URL is required.");

        var urlError = ValidateUrl(request.Url);
        if (urlError is not null)
            return ctx.ErrorResult(422, "VALIDATION_ERROR", urlError);

        var result = await service.CreateAsync(tenantId, request, ct);
        return result.IsError
            ? result.Errors.ToHttpResult(ctx)
            : Results.Created($"/api/mcp-servers/{result.Value.Id}", result.Value);
    }

    private static async Task<IResult> HandleUpdate(
        Guid serverId,
        HttpContext ctx,
        UpdateMcpServerRequest request,
        IMcpServerService service,
        CancellationToken ct
    )
    {
        var tenantId = ctx.GetTenantId();

        if (request.Url is not null)
        {
            var urlError = ValidateUrl(request.Url);
            if (urlError is not null)
                return ctx.ErrorResult(422, "VALIDATION_ERROR", urlError);
        }

        var result = await service.UpdateAsync(tenantId, serverId, request, ct);
        return result.IsError ? result.Errors.ToHttpResult(ctx) : Results.Ok(result.Value);
    }

    private static async Task<IResult> HandleDelete(
        Guid serverId,
        HttpContext ctx,
        IMcpServerService service,
        CancellationToken ct
    )
    {
        var tenantId = ctx.GetTenantId();
        var result = await service.DeleteAsync(tenantId, serverId, ct);
        return result.IsError ? result.Errors.ToHttpResult(ctx) : Results.NoContent();
    }

    private static async Task<IResult> HandleSync(
        Guid serverId,
        HttpContext ctx,
        IMcpServerService service,
        CancellationToken ct
    )
    {
        var tenantId = ctx.GetTenantId();
        var result = await service.SyncAsync(tenantId, serverId, ct);
        return result.IsError ? result.Errors.ToHttpResult(ctx) : Results.Ok(result.Value);
    }

    private static string? ValidateUrl(string url)
    {
        if (
            !Uri.TryCreate(url, UriKind.Absolute, out var uri)
            || (uri.Scheme != "https" && !(uri.Scheme == "http" && IsLoopbackHost(uri.Host)))
        )
            return "URL must be HTTPS or http://localhost.";

        return null;
    }

    private static bool IsLoopbackHost(string host) =>
        host is "localhost" || (IPAddress.TryParse(host, out var ip) && IPAddress.IsLoopback(ip));
}
