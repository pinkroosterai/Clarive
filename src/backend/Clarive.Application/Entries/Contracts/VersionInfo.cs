namespace Clarive.Application.Entries.Contracts;

public record VersionInfo(
    int Version,
    string VersionState,
    DateTime? PublishedAt,
    string? PublishedBy
);
