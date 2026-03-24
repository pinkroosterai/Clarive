using ErrorOr;

namespace Clarive.Application.Variants.Contracts;

public interface IVariantService
{
    Task<ErrorOr<VariantInfo>> CreateAsync(
        Guid tenantId, Guid entryId, CreateVariantRequest request, CancellationToken ct = default);

    Task<ErrorOr<List<VariantInfo>>> ListAsync(
        Guid tenantId, Guid entryId, CancellationToken ct = default);

    Task<ErrorOr<VariantInfo>> RenameAsync(
        Guid tenantId, Guid entryId, Guid variantId, RenameVariantRequest request, CancellationToken ct = default);

    Task<ErrorOr<bool>> DeleteAsync(
        Guid tenantId, Guid entryId, Guid variantId, CancellationToken ct = default);
}
