using System.Text.Json;
using Clarive.Api.Models.Responses;
using Microsoft.EntityFrameworkCore;

namespace Clarive.Api.Middleware;

public class ErrorHandlingMiddleware(RequestDelegate next, ILogger<ErrorHandlingMiddleware> logger)
{
    public async Task InvokeAsync(HttpContext context)
    {
        try
        {
            await next(context);
        }
        catch (DbUpdateConcurrencyException ex)
        {
            logger.LogWarning(ex, "Concurrency conflict on {Method} {Path}", context.Request.Method, context.Request.Path);
            await HandleConcurrencyAsync(context);
        }
        catch (OperationCanceledException) when (context.RequestAborted.IsCancellationRequested)
        {
            // Client disconnected — not an error
            logger.LogInformation("Request cancelled by client on {Method} {Path}", context.Request.Method, context.Request.Path);
        }
        catch (Exception ex)
        {
            logger.LogError(ex, "Unhandled exception on {Method} {Path}", context.Request.Method, context.Request.Path);
            await HandleExceptionAsync(context, ex);
        }
    }

    private static async Task HandleConcurrencyAsync(HttpContext context)
    {
        context.Response.StatusCode = StatusCodes.Status409Conflict;
        context.Response.ContentType = "application/json";

        var response = new ErrorResponse(new ErrorDetail(
            "CONCURRENCY_CONFLICT",
            "The resource was modified by another request. Please reload and try again."));

        var options = new JsonSerializerOptions { PropertyNamingPolicy = JsonNamingPolicy.CamelCase };
        await context.Response.WriteAsJsonAsync(response, options);
    }

    private static async Task HandleExceptionAsync(HttpContext context, Exception exception)
    {
        context.Response.StatusCode = 500;
        context.Response.ContentType = "application/json";

        var isDev = context.RequestServices.GetRequiredService<IHostEnvironment>().IsDevelopment();

        object? details = isDev
            ? new { message = exception.Message, stackTrace = exception.StackTrace }
            : null;

        var response = new ErrorResponse(new ErrorDetail(
            "INTERNAL_ERROR",
            isDev ? exception.Message : "An unexpected error occurred.",
            details));

        var options = new JsonSerializerOptions { PropertyNamingPolicy = JsonNamingPolicy.CamelCase };
        await context.Response.WriteAsJsonAsync(response, options);
    }
}
