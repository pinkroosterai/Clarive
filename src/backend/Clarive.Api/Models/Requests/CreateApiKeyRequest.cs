namespace Clarive.Api.Models.Requests;

public record CreateApiKeyRequest(string Name, DateTime? ExpiresAt = null);
