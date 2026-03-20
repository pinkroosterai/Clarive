namespace Clarive.Core.Models.Responses;

public record TagSummary(string Name, int EntryCount);

public record EntryActivityItem(
    Guid Id,
    string Action,
    string UserName,
    string? Details,
    int? Version,
    DateTime Timestamp
);

public record EntryActivityResponse(
    List<EntryActivityItem> Items,
    int Total,
    int Page,
    int PageSize
);
