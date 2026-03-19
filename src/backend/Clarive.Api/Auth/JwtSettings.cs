namespace Clarive.Api.Auth;

public record JwtSettings
{
    public string Secret { get; init; } = "";
    public string Issuer { get; init; } = "";
    public string Audience { get; init; } = "";
    public int ExpirationMinutes { get; init; } = 15;
    public int RefreshTokenExpirationDays { get; init; } = 7;
}
