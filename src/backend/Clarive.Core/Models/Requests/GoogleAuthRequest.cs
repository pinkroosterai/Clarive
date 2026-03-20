namespace Clarive.Core.Models.Requests;

public record GoogleAuthRequest(string IdToken, string? Nonce);
