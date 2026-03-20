namespace Clarive.Application.McpServers.Contracts;

public record McpServerResponse(
    Guid Id,
    string Name,
    string Url,
    bool HasBearerToken,
    bool IsActive,
    DateTime? LastSyncedAt,
    DateTime? NextSyncAt,
    string? LastSyncError,
    int ToolCount,
    DateTime CreatedAt,
    DateTime UpdatedAt
);
