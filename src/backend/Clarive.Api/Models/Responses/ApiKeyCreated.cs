namespace Clarive.Api.Models.Responses;

public record ApiKeyCreated(
    Guid Id,
    string Name,
    string Key,
    string Prefix,
    DateTime CreatedAt,
    DateTime? ExpiresAt,
    DateTime? LastUsedAt,
    long UsageCount
);
