using Clarive.Api.Models.Enums;

namespace Clarive.Api.Models.Entities;

public class FeedbackEntry
{
    public Guid Id { get; set; }
    public Guid UserId { get; set; }
    public string UserName { get; set; } = "";
    public string UserEmail { get; set; } = "";
    public FeedbackCategory Category { get; set; }
    public string Message { get; set; } = "";
    public string? PageUrl { get; set; }
    public string? UserAgent { get; set; }
    public DateTime CreatedAt { get; set; }
}
