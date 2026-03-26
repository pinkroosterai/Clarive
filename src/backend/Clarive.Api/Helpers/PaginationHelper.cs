namespace Clarive.Api.Helpers;

internal static class PaginationHelper
{
    public const int MaxPageSize = 100;
    public const int DefaultPageSize = 50;

    public static (int page, int pageSize) Normalize(int? page, int? pageSize)
    {
        var p = page is > 0 ? page.Value : 1;
        var ps = pageSize is > 0 ? Math.Min(pageSize.Value, MaxPageSize) : DefaultPageSize;
        return (p, ps);
    }
}
