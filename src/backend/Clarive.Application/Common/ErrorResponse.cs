namespace Clarive.Application.Common;

public record ErrorResponse(ErrorDetail Error);

public record ErrorDetail(string Code, string Message, object? Details = null);
