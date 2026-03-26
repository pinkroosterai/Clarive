using System.Text.RegularExpressions;
using ErrorOr;
using MiniValidation;

namespace Clarive.Application.Common;

public static partial class Validator
{
    [GeneratedRegex(@"^[^@\s]+@[^@\s]+\.[^@\s]+$")]
    private static partial Regex EmailRegex();

    public static bool IsValidEmail(string email) => EmailRegex().IsMatch(email);

    public const int MinPasswordLength = 12;

    /// <summary>
    /// Validates a request object using Data Annotations via MiniValidation.
    /// Returns a 422 error result if invalid; null if valid.
    /// </summary>
    public static IResult? ValidateRequest<T>(T request)
        where T : class
    {
        if (!MiniValidator.TryValidate(request, out var errors))
        {
            var firstError = errors.Values.ToArray()[0][0];
            return Results.Json(
                new ErrorResponse(new("VALIDATION_ERROR", firstError)),
                statusCode: 422
            );
        }

        return null;
    }

    /// <summary>
    /// Validates a request object using Data Annotations via MiniValidation.
    /// Returns an ErrorOr-compatible Error if invalid; null if valid.
    /// Use this in the service layer instead of ValidateRequest.
    /// </summary>
    public static Error? ValidateAndGetError<T>(T request)
        where T : class
    {
        if (!MiniValidator.TryValidate(request, out var errors))
        {
            var firstError = errors.Values.ToArray()[0][0];
            return Error.Validation("VALIDATION_ERROR", firstError);
        }

        return null;
    }
}
