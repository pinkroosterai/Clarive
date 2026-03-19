namespace Clarive.Api.Models.Responses;

public record ErrorResponse(ErrorDetail Error);

public record ErrorDetail(string Code, string Message, object? Details = null);
