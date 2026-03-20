namespace Clarive.Application.Auth.Contracts;

public record GoogleAuthRequest(string IdToken, string? Nonce);
