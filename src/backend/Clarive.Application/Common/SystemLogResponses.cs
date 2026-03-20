namespace Clarive.Application.Common;

public record SystemLogEntry(
    long Id,
    DateTime Timestamp,
    string Level,
    string? SourceContext,
    string Message,
    string? Exception,
    string? Properties
);

public record SystemLogPagedResponse(
    List<SystemLogEntry> Items,
    int Page,
    int PageSize,
    long TotalCount
);
