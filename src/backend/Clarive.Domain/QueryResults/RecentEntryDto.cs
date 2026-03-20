namespace Clarive.Domain.QueryResults;

public record RecentEntryDto(Guid Id, string Title, string VersionState, DateTime UpdatedAt);
