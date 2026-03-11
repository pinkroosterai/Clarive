namespace Clarive.Api.Models.Requests;

public record GoogleAuthRequest(string IdToken, string? Nonce);
