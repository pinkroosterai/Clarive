namespace Clarive.Api.Models.Responses;

public record VersionInfo(
    int Version,
    string VersionState,
    DateTime? PublishedAt,
    string? PublishedBy
);
