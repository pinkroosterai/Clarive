using Clarive.Api.Models.Responses;
using ErrorOr;

namespace Clarive.Api.Services.Interfaces;

public interface ISuperAdminService
{
    Task<PlatformStatsResponse> GetPlatformStatsAsync(CancellationToken ct);

    Task<(List<SuperUserResponse> Users, int Total)> GetAllUsersPagedAsync(
        int page,
        int pageSize,
        string? search,
        string? sortBy,
        bool sortDesc,
        CancellationToken ct
    );

    Task<bool> HardDeleteUserAsync(Guid userId, CancellationToken ct);

    Task<bool> SoftDeleteUserAsync(Guid userId, CancellationToken ct);

    Task<ErrorOr<string>> ResetUserPasswordAsync(Guid userId, CancellationToken ct);
}
