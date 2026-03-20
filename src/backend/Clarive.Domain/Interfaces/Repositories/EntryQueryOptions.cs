namespace Clarive.Domain.Interfaces.Repositories;

public record EntryQueryOptions(
    int Page = 1,
    int PageSize = 50,
    string? Search = null,
    string? Status = null,
    string? SortBy = null,
    IQueryable<Guid>? FilteredEntryIds = null
);
