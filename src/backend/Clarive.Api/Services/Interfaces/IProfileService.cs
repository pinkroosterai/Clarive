using Clarive.Api.Models.Entities;
using Clarive.Api.Models.Requests;
using ErrorOr;

namespace Clarive.Api.Services.Interfaces;

public interface IProfileService
{
    Task<ErrorOr<User>> UpdateProfileAsync(
        Guid tenantId,
        Guid userId,
        UpdateProfileRequest request,
        CancellationToken ct = default
    );

    Task<ErrorOr<Success>> CompleteOnboardingAsync(
        Guid tenantId,
        Guid userId,
        CancellationToken ct = default
    );
}
