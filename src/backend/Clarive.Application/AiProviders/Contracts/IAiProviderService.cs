using Clarive.Domain.ValueObjects;
using ErrorOr;

namespace Clarive.Application.AiProviders.Contracts;

public interface IAiProviderService
{
    Task<List<AiProviderResponse>> GetAllAsync(CancellationToken ct);
    Task<ErrorOr<AiProviderResponse>> GetByIdAsync(Guid id, CancellationToken ct);
    Task<ErrorOr<AiProviderResponse>> CreateAsync(
        CreateAiProviderRequest request,
        CancellationToken ct
    );
    Task<ErrorOr<AiProviderResponse>> UpdateAsync(
        Guid id,
        UpdateAiProviderRequest request,
        CancellationToken ct
    );
    Task<ErrorOr<Success>> DeleteAsync(Guid id, CancellationToken ct);
    Task<ErrorOr<FetchedModelsResponse>> FetchModelsAsync(Guid id, CancellationToken ct);
    Task<ErrorOr<Success>> ValidateAsync(Guid id, CancellationToken ct);
    Task<ErrorOr<AiProviderModelResponse>> AddModelAsync(
        Guid providerId,
        AddAiProviderModelRequest request,
        CancellationToken ct
    );
    Task<ErrorOr<AiProviderModelResponse>> UpdateModelAsync(
        Guid modelId,
        UpdateAiProviderModelRequest request,
        CancellationToken ct
    );
    Task<ErrorOr<Success>> DeleteModelAsync(Guid modelId, CancellationToken ct);
}
