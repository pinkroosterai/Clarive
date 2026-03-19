namespace Clarive.Api.Models.Responses;

public record DashboardStatsResponse(
    int TotalEntries,
    int PublishedEntries,
    int DraftEntries,
    int TotalFolders,
    List<RecentEntryDto> RecentEntries,
    List<RecentActivityDto> RecentActivity,
    List<FavoriteEntryDto> FavoriteEntries
);

public record RecentEntryDto(Guid Id, string Title, string VersionState, DateTime UpdatedAt);

public record FavoriteEntryDto(Guid Id, string Title, string VersionState, DateTime FavoritedAt);

public record RecentActivityDto(
    Guid Id,
    string Action,
    string EntityType,
    string UserName,
    string? Details,
    DateTime Timestamp
);
