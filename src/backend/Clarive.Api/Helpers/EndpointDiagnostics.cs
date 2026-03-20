using Microsoft.AspNetCore.Http;

namespace Clarive.Api.Helpers;

public static class EndpointDiagnostics
{
    /// <summary>
    /// Returns a JSON error response and stores ErrorCode, EntityType, and EntityId
    /// on <see cref="HttpContext.Items"/> so Serilog request logging can enrich the
    /// diagnostic context automatically — no explicit ILogger calls required.
    /// </summary>
    public static IResult ErrorResult(
        this HttpContext ctx,
        int statusCode,
        string errorCode,
        string message,
        string? entityType = null,
        string? entityId = null
    )
    {
        ctx.Items["log:ErrorCode"] = errorCode;
        if (entityType is not null)
            ctx.Items["log:EntityType"] = entityType;
        if (entityId is not null)
            ctx.Items["log:EntityId"] = entityId;

        return Results.Json(new ErrorResponse(new(errorCode, message)), statusCode: statusCode);
    }

    /// <summary>
    /// Returns a JSON error response with field-level details (e.g., validation errors)
    /// and stores ErrorCode on <see cref="HttpContext.Items"/> for Serilog enrichment.
    /// </summary>
    public static IResult ErrorResult(
        this HttpContext ctx,
        int statusCode,
        string errorCode,
        string message,
        object details
    )
    {
        ctx.Items["log:ErrorCode"] = errorCode;

        return Results.Json(
            new ErrorResponse(new(errorCode, message, details)),
            statusCode: statusCode
        );
    }
}
