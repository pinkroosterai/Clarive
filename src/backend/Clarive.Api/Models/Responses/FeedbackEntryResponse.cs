namespace Clarive.Api.Models.Responses;

public record FeedbackEntryResponse(
    Guid Id,
    string UserName,
    string UserEmail,
    string Category,
    string Message,
    string? PageUrl,
    string? UserAgent,
    DateTime CreatedAt);
