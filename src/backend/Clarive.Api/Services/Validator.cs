using System.Text.RegularExpressions;
using Clarive.Api.Models.Responses;

namespace Clarive.Api.Services;

public static partial class Validator
{
    [GeneratedRegex(@"^[^@\s]+@[^@\s]+\.[^@\s]+$")]
    private static partial Regex EmailRegex();

    public static bool IsValidEmail(string email) => EmailRegex().IsMatch(email);

    /// <summary>Returns a 422 error result if the value is null/empty or exceeds maxLength; null if valid.</summary>
    public static IResult? RequireString(string? value, string fieldName, int maxLength = 255)
    {
        if (string.IsNullOrWhiteSpace(value))
            return Results.Json(
                new ErrorResponse(new("VALIDATION_ERROR", $"{fieldName} is required.")),
                statusCode: 422);

        if (value.Trim().Length > maxLength)
            return Results.Json(
                new ErrorResponse(new("VALIDATION_ERROR", $"{fieldName} must be {maxLength} characters or fewer.")),
                statusCode: 422);

        return null;
    }

    /// <summary>Returns a 422 error result if the email is invalid; null if valid.</summary>
    public static IResult? RequireValidEmail(string? email)
    {
        if (string.IsNullOrWhiteSpace(email))
            return Results.Json(
                new ErrorResponse(new("VALIDATION_ERROR", "Email is required.")),
                statusCode: 422);

        if (!IsValidEmail(email))
            return Results.Json(
                new ErrorResponse(new("VALIDATION_ERROR", "Invalid email format.")),
                statusCode: 422);

        return null;
    }

    /// <summary>Returns a 422 error result if the password is too short; null if valid.</summary>
    public const int MinPasswordLength = 12;

    public static IResult? RequirePassword(string? password, int minLength = MinPasswordLength)
    {
        if (string.IsNullOrWhiteSpace(password))
            return Results.Json(
                new ErrorResponse(new("VALIDATION_ERROR", "Password is required.")),
                statusCode: 422);

        if (password.Length < minLength)
            return Results.Json(
                new ErrorResponse(new("VALIDATION_ERROR", $"Password must be at least {minLength} characters.")),
                statusCode: 422);

        return null;
    }
}
