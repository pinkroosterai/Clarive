using Clarive.Domain.QueryResults;

namespace Clarive.Application.Common;

public record DashboardStatsResponse(
    int TotalEntries,
    int PublishedEntries,
    int UnpublishedEntries,
    int TotalFolders,
    List<RecentEntryDto> RecentEntries,
    List<RecentActivityDto> RecentActivity,
    List<FavoriteEntryDto> FavoriteEntries
);

public record FavoriteEntryDto(Guid Id, string Title, string VersionState, DateTime FavoritedAt);

public record RecentActivityDto(
    Guid Id,
    string Action,
    string EntityType,
    string UserName,
    string? Details,
    DateTime Timestamp
);
