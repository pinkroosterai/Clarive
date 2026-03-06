using System.Net;
using System.Text.RegularExpressions;
using Clarive.Api.Models.Entities;
using Clarive.Api.Models.Requests;
using Clarive.Api.Models.Responses;
using Clarive.Api.Repositories.Interfaces;
using Clarive.Api.Services.Interfaces;
using Clarive.Api.Auth;
using Clarive.Api.Helpers;

namespace Clarive.Api.Endpoints;

public static partial class ToolEndpoints
{
    [GeneratedRegex(@"^[a-zA-Z_][a-zA-Z0-9_.\-]*$")]
    private static partial Regex ToolNameRegex();

    public static RouteGroupBuilder MapToolEndpoints(this IEndpointRouteBuilder app)
    {
        var group = app.MapGroup("/api/tools")
            .WithTags("Tools")
            .RequireAuthorization();

        group.MapGet("/", HandleList);

        group.MapPost("/", HandleCreate)
            .RequireAuthorization("EditorOrAdmin");

        group.MapPatch("/{toolId:guid}", HandleUpdate)
            .RequireAuthorization("EditorOrAdmin");

        group.MapDelete("/{toolId:guid}", HandleDelete)
            .RequireAuthorization("EditorOrAdmin");

        group.MapPost("/import-mcp", HandleImportMcp)
            .RequireAuthorization("EditorOrAdmin");

        return group;
    }

    private static async Task<IResult> HandleList(
        HttpContext ctx,
        IToolRepository toolRepo,
        CancellationToken ct,
        int page = 1,
        int pageSize = 50)
    {
        var tenantId = ctx.GetTenantId();
        if (page < 1) page = 1;
        if (pageSize is < 1 or > 100) pageSize = 50;

        var (items, total) = await toolRepo.GetByTenantPagedAsync(tenantId, page, pageSize, ct);
        return Results.Ok(new { items, total, page, pageSize });
    }

    private static async Task<IResult> HandleCreate(
        HttpContext ctx,
        CreateToolRequest request,
        IToolRepository toolRepo,
        CancellationToken ct)
    {
        var tenantId = ctx.GetTenantId();

        if (string.IsNullOrWhiteSpace(request.Name))
            return ctx.ErrorResult(422, "VALIDATION_ERROR", "Name is required.");

        if (request.Name.Trim().Length > 100)
            return ctx.ErrorResult(422, "VALIDATION_ERROR", "Name must be 100 characters or fewer.");

        if (string.IsNullOrWhiteSpace(request.ToolName) || !ToolNameRegex().IsMatch(request.ToolName))
            return ctx.ErrorResult(422, "VALIDATION_ERROR", "toolName must contain only letters, numbers, underscores, dots, and hyphens..");

        var tool = await toolRepo.CreateAsync(new ToolDescription
        {
            Id = Guid.NewGuid(),
            TenantId = tenantId,
            Name = request.Name.Trim(),
            ToolName = request.ToolName.Trim(),
            Description = request.Description?.Trim() ?? "",
            CreatedAt = DateTime.UtcNow
        }, ct);

        return Results.Created($"/api/tools/{tool.Id}", tool);
    }

    private static async Task<IResult> HandleUpdate(
        Guid toolId,
        HttpContext ctx,
        UpdateToolRequest request,
        IToolRepository toolRepo,
        CancellationToken ct)
    {
        var tenantId = ctx.GetTenantId();
        var tool = await toolRepo.GetByIdAsync(tenantId, toolId, ct);
        if (tool is null)
            return ctx.ErrorResult(404, "NOT_FOUND", "Tool not found.", "Tool", toolId.ToString());

        if (request.Name is not null && request.Name.Trim().Length > 100)
            return ctx.ErrorResult(422, "VALIDATION_ERROR", "Name must be 100 characters or fewer.");

        if (request.ToolName is not null && !ToolNameRegex().IsMatch(request.ToolName))
            return ctx.ErrorResult(422, "VALIDATION_ERROR", "toolName must contain only letters, numbers, underscores, dots, and hyphens..");

        if (request.ToolName is not null && request.ToolName.Trim().Length > 100)
            return ctx.ErrorResult(422, "VALIDATION_ERROR", "toolName must be 100 characters or fewer.");

        if (request.Name is not null) tool.Name = request.Name.Trim();
        if (request.ToolName is not null) tool.ToolName = request.ToolName.Trim();
        if (request.Description is not null) tool.Description = request.Description.Trim();
        await toolRepo.UpdateAsync(tool, ct);

        return Results.Ok(tool);
    }

    private static async Task<IResult> HandleDelete(
        Guid toolId,
        HttpContext ctx,
        IToolRepository toolRepo,
        CancellationToken ct)
    {
        var tenantId = ctx.GetTenantId();
        var tool = await toolRepo.GetByIdAsync(tenantId, toolId, ct);
        if (tool is null)
            return ctx.ErrorResult(404, "NOT_FOUND", "Tool not found.", "Tool", toolId.ToString());

        await toolRepo.DeleteAsync(tenantId, toolId, ct);
        return Results.NoContent();
    }

    private static async Task<IResult> HandleImportMcp(
        HttpContext ctx,
        McpImportRequest request,
        IMcpImportService mcpService,
        CancellationToken ct)
    {
        if (string.IsNullOrWhiteSpace(request.ServerUrl))
            return ctx.ErrorResult(422, "VALIDATION_ERROR", "Server URL is required.");

        if (!Uri.TryCreate(request.ServerUrl, UriKind.Absolute, out var uri)
            || (uri.Scheme != "https" && !(uri.Scheme == "http" && IsLoopbackHost(uri.Host))))
            return ctx.ErrorResult(422, "VALIDATION_ERROR",
                "Server URL must be HTTPS or http://localhost.");

        try
        {
            var result = await mcpService.ImportToolsAsync(
                request.ServerUrl, request.BearerToken, ctx.GetTenantId(), ct);

            return Results.Ok(new McpImportResponse(result.Imported, result.SkippedCount));
        }
        catch (HttpRequestException ex)
        {
            ctx.RequestServices.GetRequiredService<ILoggerFactory>()
                .CreateLogger("ToolEndpoints")
                .LogWarning(ex, "MCP import failed for URL {Url}", request.ServerUrl);
            return ctx.ErrorResult(502, "MCP_CONNECTION_FAILED",
                "Could not connect to the specified MCP server.");
        }
        catch (TaskCanceledException)
        {
            return ctx.ErrorResult(502, "MCP_CONNECTION_FAILED",
                "MCP server did not respond within the timeout period.");
        }
        catch (InvalidOperationException ex)
        {
            ctx.RequestServices.GetRequiredService<ILoggerFactory>()
                .CreateLogger("ToolEndpoints")
                .LogWarning(ex, "MCP server error for URL {Url}", request.ServerUrl);
            return ctx.ErrorResult(502, "MCP_SERVER_ERROR",
                "The MCP server returned an invalid response.");
        }
    }

    private static bool IsLoopbackHost(string host)
        => host is "localhost"
            || (IPAddress.TryParse(host, out var ip) && IPAddress.IsLoopback(ip));
}
