namespace Clarive.Application.Common;

public interface IOnboardingSeeder
{
    Task SeedStarterTemplatesAsync(Guid tenantId, Guid userId, CancellationToken ct);
}
