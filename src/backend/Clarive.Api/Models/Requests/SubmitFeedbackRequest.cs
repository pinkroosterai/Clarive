namespace Clarive.Api.Models.Requests;

public record SubmitFeedbackRequest(string Category, string Message, string? PageUrl);
