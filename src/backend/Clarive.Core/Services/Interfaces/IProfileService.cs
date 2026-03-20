using Clarive.Domain.Entities;
using Clarive.Core.Models.Requests;
using Clarive.Domain.ValueObjects;
using ErrorOr;

namespace Clarive.Core.Services.Interfaces;

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
