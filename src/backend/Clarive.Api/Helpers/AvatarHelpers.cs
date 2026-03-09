using Clarive.Api.Models.Entities;

namespace Clarive.Api.Helpers;

public static class AvatarHelpers
{
    public static string? TenantAvatarUrl(Tenant? tenant)
        => tenant?.AvatarPath != null ? $"/api/tenants/{tenant.Id}/avatar" : null;

    public static string? UserAvatarUrl(User user)
        => user.AvatarPath != null ? $"/api/users/{user.Id}/avatar" : null;

    /// <summary>
    /// Validates avatar upload form data. Returns an error result if invalid, or the file if valid.
    /// </summary>
    public static (IFormFile? File, IResult? Error) ValidateUpload(HttpContext ctx)
    {
        if (!ctx.Request.HasFormContentType || ctx.Request.Form.Files.Count == 0)
            return (null, ctx.ErrorResult(422, "VALIDATION_ERROR", "No file uploaded."));

        var file = ctx.Request.Form.Files[0];

        if (file.Length == 0)
            return (null, ctx.ErrorResult(422, "VALIDATION_ERROR", "Uploaded file is empty."));

        if (file.Length > 3 * 1024 * 1024)
            return (null, ctx.ErrorResult(413, "FILE_TOO_LARGE", "Image exceeds the 3 MB size limit."));

        return (file, null);
    }
}
