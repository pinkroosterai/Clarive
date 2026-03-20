using Clarive.Domain.Enums;
using Clarive.Core.Models.Responses;
using ErrorOr;
using Microsoft.Extensions.AI;

namespace Clarive.Core.Services.Interfaces;

public record ResolvedModel(
    IChatClient ChatClient,
    string Model,
    string ProviderName,
    bool IsTemperatureConfigurable,
    AiApiMode ApiMode
);

public interface IModelResolutionService
{
    Task<ErrorOr<ResolvedModel>> ResolveProviderForModelAsync(string model, CancellationToken ct);

    Task<ErrorOr<List<EnrichedModelResponse>>> GetEnrichedModelsAsync(CancellationToken ct);

    Task<ErrorOr<List<string>>> GetAvailableModelsAsync(CancellationToken ct);
}
