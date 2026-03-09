using Clarive.Api.Models.Entities;
using Clarive.Api.Models.Requests;

namespace Clarive.Api.Services.Interfaces;

public interface IProfileService
{
    Task<(User? User, string? ErrorCode, string? Message)> UpdateProfileAsync(
        Guid tenantId, Guid userId, UpdateProfileRequest request, CancellationToken ct = default);

    Task<(bool Success, string? ErrorCode, string? Message)> CompleteOnboardingAsync(
        Guid tenantId, Guid userId, CancellationToken ct = default);
}
