using Clarive.Domain.Entities;
using Clarive.Domain.ValueObjects;
using ErrorOr;

namespace Clarive.Application.Profile.Contracts;

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

    Task<ErrorOr<Success>> ResetOnboardingAsync(
        Guid tenantId,
        Guid userId,
        CancellationToken ct = default
    );
}
