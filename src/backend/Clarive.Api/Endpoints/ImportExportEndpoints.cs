using Clarive.Api.Auth;
using Clarive.Api.Helpers;
using Clarive.Api.Models.Requests;
using Clarive.Domain.ValueObjects;
using Clarive.Api.Services.Interfaces;
using YamlDotNet.Core;
using YamlDotNet.Serialization;
using YamlDotNet.Serialization.NamingConventions;

namespace Clarive.Api.Endpoints;

public static class ImportExportEndpoints
{
    private const long MaxImportFileSize = 10 * 1024 * 1024; // 10 MB
    private const int MaxImportEntries = 500;

    public static RouteGroupBuilder MapImportExportEndpoints(this IEndpointRouteBuilder app)
    {
        var group = app.MapGroup("/api")
            .WithTags("Import/Export")
            .RequireAuthorization("EditorOrAdmin");

        group.MapPost("/export", HandleExport);
        group.MapPost("/import", HandleImport).DisableAntiforgery();

        return group;
    }

    private static async Task<IResult> HandleExport(
        HttpContext ctx,
        ExportRequest? request,
        IImportExportService importExportService,
        CancellationToken ct
    )
    {
        var tenantId = ctx.GetTenantId();
        var result = await importExportService.ExportAsync(tenantId, request, ct);
        return Results.File(result.Bytes, result.ContentType, result.FileName);
    }

    private static async Task<IResult> HandleImport(
        HttpContext ctx,
        IImportExportService importExportService,
        CancellationToken ct
    )
    {
        var tenantId = ctx.GetTenantId();
        var userId = ctx.GetUserId();

        var (entryList, error) = await ReadAndParseImportFileAsync(ctx, ct);
        if (error is not null)
            return error;

        var result = await importExportService.ImportAsync(tenantId, userId, entryList!, ct);
        return Results.Ok(result);
    }

    private static async Task<(List<object>? entries, IResult? error)> ReadAndParseImportFileAsync(
        HttpContext ctx,
        CancellationToken ct
    )
    {
        if (!ctx.Request.HasFormContentType)
            return (
                null,
                ctx.ErrorResult(
                    422,
                    "VALIDATION_ERROR",
                    "Expected multipart/form-data with a 'file' field."
                )
            );

        var form = await ctx.Request.ReadFormAsync(ct);
        var file = form.Files.GetFile("file");
        if (file is null || file.Length == 0)
            return (null, ctx.ErrorResult(422, "VALIDATION_ERROR", "No file uploaded."));

        if (file.Length > MaxImportFileSize)
            return (
                null,
                ctx.ErrorResult(
                    422,
                    "VALIDATION_ERROR",
                    $"File size exceeds the {MaxImportFileSize / (1024 * 1024)} MB limit."
                )
            );

        string yamlContent;
        using (var reader = new StreamReader(file.OpenReadStream()))
        {
            yamlContent = await reader.ReadToEndAsync(ct);
        }

        Dictionary<string, object>? parsed;
        try
        {
            var deserializer = new DeserializerBuilder()
                .WithNamingConvention(CamelCaseNamingConvention.Instance)
                .Build();
            parsed = deserializer.Deserialize<Dictionary<string, object>>(yamlContent);
        }
        catch (YamlException)
        {
            return (null, ctx.ErrorResult(422, "VALIDATION_ERROR", "Invalid YAML format."));
        }

        if (
            parsed is null
            || !parsed.TryGetValue("entries", out var entriesObj)
            || entriesObj is not List<object> entryList
        )
        {
            return (
                null,
                ctx.ErrorResult(422, "VALIDATION_ERROR", "YAML must contain an 'entries' array.")
            );
        }

        if (entryList.Count > MaxImportEntries)
            return (
                null,
                ctx.ErrorResult(
                    422,
                    "VALIDATION_ERROR",
                    $"Import cannot exceed {MaxImportEntries} entries."
                )
            );

        return (entryList, null);
    }
}
