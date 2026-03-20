namespace Clarive.Application.Auth;

public record GoogleAuthRequest(string IdToken, string? Nonce);
