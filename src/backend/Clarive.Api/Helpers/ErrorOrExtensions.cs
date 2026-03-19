using ErrorOr;

namespace Clarive.Api.Helpers;

public static class ErrorOrExtensions
{
    /// <summary>
    /// Converts the first ErrorOr error to an HTTP result using the existing
    /// EndpointDiagnostics.ErrorResult for consistent error shapes and Serilog enrichment.
    /// </summary>
    public static IResult ToHttpResult(
        this List<Error> errors,
        HttpContext ctx,
        string? entityType = null,
        string? entityId = null
    )
    {
        var error = errors[0];

        var statusCode = error.Type switch
        {
            ErrorType.NotFound => 404,
            ErrorType.Validation => 422,
            ErrorType.Conflict => 409,
            ErrorType.Unauthorized => 401,
            ErrorType.Forbidden => 403,
            _ when error.NumericType >= 400 && error.NumericType < 600 => error.NumericType,
            _ => 400,
        };

        return ctx.ErrorResult(statusCode, error.Code, error.Description, entityType, entityId);
    }
}
