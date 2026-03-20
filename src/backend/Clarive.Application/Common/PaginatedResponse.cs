namespace Clarive.Application.Common;

public record PaginatedResponse<T>(List<T> Items, int TotalCount, int Page, int PageSize);
