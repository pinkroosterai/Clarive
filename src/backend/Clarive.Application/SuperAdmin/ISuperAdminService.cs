using ErrorOr;

namespace Clarive.Application.SuperAdmin;

public interface ISuperAdminService
{
    Task<PlatformStatsResponse> GetPlatformStatsAsync(CancellationToken ct);

    Task<(List<SuperUserResponse> Users, int Total)> GetAllUsersPagedAsync(
        int page,
        int pageSize,
        string? search,
        string? role,
        string? authType,
        string? sortBy,
        bool sortDesc,
        CancellationToken ct
    );

    Task<bool> HardDeleteUserAsync(Guid userId, CancellationToken ct);

    Task<bool> SoftDeleteUserAsync(Guid userId, CancellationToken ct);

    Task<ErrorOr<string>> ResetUserPasswordAsync(Guid userId, CancellationToken ct);
}
