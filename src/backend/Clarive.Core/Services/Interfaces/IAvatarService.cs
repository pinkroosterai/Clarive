namespace Clarive.Core.Services.Interfaces;

public interface IAvatarService
{
    Task<string> SaveAsync(
        Guid userId,
        Stream imageStream,
        string contentType,
        CancellationToken ct = default
    );
    Task DeleteAsync(Guid userId, CancellationToken ct = default);
    string? GetAbsolutePath(string? relativePath);
    Task<string> SaveTenantAvatarAsync(
        Guid tenantId,
        Stream imageStream,
        string contentType,
        CancellationToken ct = default
    );
    Task DeleteTenantAvatarAsync(Guid tenantId, CancellationToken ct = default);
}
