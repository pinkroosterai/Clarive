using Clarive.Api.Models.Responses;
using ErrorOr;
using Microsoft.Extensions.AI;

namespace Clarive.Api.Services.Interfaces;

public record ResolvedModel(
    IChatClient ChatClient,
    string Model,
    string ProviderName,
    bool IsTemperatureConfigurable);

public interface IModelResolutionService
{
    Task<ErrorOr<ResolvedModel>> ResolveProviderForModelAsync(string model, CancellationToken ct);

    Task<ErrorOr<List<EnrichedModelResponse>>> GetEnrichedModelsAsync(CancellationToken ct);

    Task<ErrorOr<List<string>>> GetAvailableModelsAsync(CancellationToken ct);
}
