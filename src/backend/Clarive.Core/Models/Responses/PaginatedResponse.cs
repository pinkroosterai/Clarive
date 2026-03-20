namespace Clarive.Core.Models.Responses;

public record PaginatedResponse<T>(List<T> Items, int TotalCount, int Page, int PageSize);
