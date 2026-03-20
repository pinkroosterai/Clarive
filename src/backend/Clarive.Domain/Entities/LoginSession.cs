namespace Clarive.Domain.Entities;

public class LoginSession
{
    public Guid Id { get; set; }
    public Guid UserId { get; set; }
    public Guid RefreshTokenId { get; set; }
    public string IpAddress { get; set; } = "";
    public string UserAgent { get; set; } = "";
    public string Browser { get; set; } = "";
    public string Os { get; set; } = "";
    public DateTime CreatedAt { get; set; }
}
