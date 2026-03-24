using Clarive.Api.Helpers;
using Clarive.Application.TestDatasets.Contracts;

namespace Clarive.Api.Endpoints;

public static class TestDatasetEndpoints
{
    public static RouteGroupBuilder MapTestDatasetEndpoints(this IEndpointRouteBuilder app)
    {
        var group = app
            .MapGroup("/api/entries/{entryId:guid}/datasets")
            .WithTags("Test Datasets")
            .RequireAuthorization();

        group.MapGet("/", HandleList);
        group.MapGet("/{datasetId:guid}", HandleGet);
        group.MapPost("/", HandleCreate).RequireAuthorization("EditorOrAdmin");
        group.MapPut("/{datasetId:guid}", HandleUpdate).RequireAuthorization("EditorOrAdmin");
        group.MapDelete("/{datasetId:guid}", HandleDelete).RequireAuthorization("EditorOrAdmin");

        // Row operations
        group.MapPost("/{datasetId:guid}/rows", HandleAddRow).RequireAuthorization("EditorOrAdmin");
        group
            .MapPut("/{datasetId:guid}/rows/{rowId:guid}", HandleUpdateRow)
            .RequireAuthorization("EditorOrAdmin");
        group
            .MapDelete("/{datasetId:guid}/rows/{rowId:guid}", HandleDeleteRow)
            .RequireAuthorization("EditorOrAdmin");

        // AI generation
        group
            .MapPost("/{datasetId:guid}/generate", HandleGenerateRows)
            .RequireAuthorization("EditorOrAdmin");

        return group;
    }

    private static async Task<IResult> HandleList(
        HttpContext ctx,
        ITestDatasetService service,
        Guid entryId,
        CancellationToken ct)
    {
        var tenantId = ctx.GetTenantId();
        var result = await service.ListAsync(tenantId, entryId, ct);

        if (result.IsError)
            return result.Errors.ToHttpResult(ctx);

        return Results.Ok(result.Value);
    }

    private static async Task<IResult> HandleGet(
        HttpContext ctx,
        ITestDatasetService service,
        Guid entryId,
        Guid datasetId,
        CancellationToken ct)
    {
        var tenantId = ctx.GetTenantId();
        var result = await service.GetAsync(tenantId, entryId, datasetId, ct);

        if (result.IsError)
            return result.Errors.ToHttpResult(ctx);

        return Results.Ok(result.Value);
    }

    private static async Task<IResult> HandleCreate(
        HttpContext ctx,
        ITestDatasetService service,
        Guid entryId,
        CreateTestDatasetRequest request,
        CancellationToken ct)
    {
        var tenantId = ctx.GetTenantId();
        var result = await service.CreateAsync(tenantId, entryId, request, ct);

        if (result.IsError)
            return result.Errors.ToHttpResult(ctx);

        return Results.Created($"/api/entries/{entryId}/datasets/{result.Value.Id}", result.Value);
    }

    private static async Task<IResult> HandleUpdate(
        HttpContext ctx,
        ITestDatasetService service,
        Guid entryId,
        Guid datasetId,
        UpdateTestDatasetRequest request,
        CancellationToken ct)
    {
        var tenantId = ctx.GetTenantId();
        var result = await service.UpdateAsync(tenantId, entryId, datasetId, request, ct);

        if (result.IsError)
            return result.Errors.ToHttpResult(ctx);

        return Results.Ok(result.Value);
    }

    private static async Task<IResult> HandleDelete(
        HttpContext ctx,
        ITestDatasetService service,
        Guid entryId,
        Guid datasetId,
        CancellationToken ct)
    {
        var tenantId = ctx.GetTenantId();
        var result = await service.DeleteAsync(tenantId, entryId, datasetId, ct);

        if (result.IsError)
            return result.Errors.ToHttpResult(ctx);

        return Results.NoContent();
    }

    private static async Task<IResult> HandleAddRow(
        HttpContext ctx,
        ITestDatasetService service,
        Guid entryId,
        Guid datasetId,
        AddTestDatasetRowRequest request,
        CancellationToken ct)
    {
        var tenantId = ctx.GetTenantId();
        var result = await service.AddRowAsync(tenantId, entryId, datasetId, request, ct);

        if (result.IsError)
            return result.Errors.ToHttpResult(ctx);

        return Results.Created(
            $"/api/entries/{entryId}/datasets/{datasetId}/rows/{result.Value.Id}",
            result.Value);
    }

    private static async Task<IResult> HandleUpdateRow(
        HttpContext ctx,
        ITestDatasetService service,
        Guid entryId,
        Guid datasetId,
        Guid rowId,
        UpdateTestDatasetRowRequest request,
        CancellationToken ct)
    {
        var tenantId = ctx.GetTenantId();
        var result = await service.UpdateRowAsync(tenantId, entryId, datasetId, rowId, request, ct);

        if (result.IsError)
            return result.Errors.ToHttpResult(ctx);

        return Results.Ok(result.Value);
    }

    private static async Task<IResult> HandleDeleteRow(
        HttpContext ctx,
        ITestDatasetService service,
        Guid entryId,
        Guid datasetId,
        Guid rowId,
        CancellationToken ct)
    {
        var tenantId = ctx.GetTenantId();
        var result = await service.DeleteRowAsync(tenantId, entryId, datasetId, rowId, ct);

        if (result.IsError)
            return result.Errors.ToHttpResult(ctx);

        return Results.NoContent();
    }

    private static async Task<IResult> HandleGenerateRows(
        HttpContext ctx,
        ITestDatasetService service,
        Guid entryId,
        Guid datasetId,
        GenerateTestDatasetRowsRequest request,
        CancellationToken ct)
    {
        var tenantId = ctx.GetTenantId();
        var result = await service.GenerateRowsAsync(tenantId, entryId, datasetId, request, ct);

        if (result.IsError)
            return result.Errors.ToHttpResult(ctx);

        return Results.Ok(result.Value);
    }
}
