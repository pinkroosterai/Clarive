using System.ClientModel;
using Clarive.Api.Models.Entities;
using Clarive.Api.Models.Requests;
using Clarive.Api.Models.Responses;
using Clarive.Api.Repositories.Interfaces;
using Clarive.Api.Services.Agents;
using Clarive.Api.Services.Interfaces;
using ErrorOr;
using OpenAI;

namespace Clarive.Api.Services;

public class AiProviderService(
    IAiProviderRepository repo,
    IEncryptionService encryption,
    ILiteLlmRegistryCache liteLlmCache,
    ILogger<AiProviderService> logger)
{
    private static readonly HashSet<string> ValidReasoningEfforts = new(StringComparer.OrdinalIgnoreCase)
        { "low", "medium", "high", "extra-high" };

    public async Task<List<AiProviderResponse>> GetAllAsync(CancellationToken ct)
    {
        var providers = await repo.GetAllAsync(ct);
        return providers.Select(ToResponse).ToList();
    }

    public async Task<ErrorOr<AiProviderResponse>> GetByIdAsync(Guid id, CancellationToken ct)
    {
        var provider = await repo.GetByIdAsync(id, ct);
        if (provider is null)
            return Error.NotFound("NOT_FOUND", "Provider not found.");
        return ToResponse(provider);
    }

    public async Task<ErrorOr<AiProviderResponse>> CreateAsync(CreateAiProviderRequest request, CancellationToken ct)
    {
        if (!encryption.IsAvailable)
            return Error.Failure("ENCRYPTION_UNAVAILABLE", "CONFIG_ENCRYPTION_KEY is not configured.");

        if (ValidateEndpointUrl(request.EndpointUrl) is { } urlError)
            return urlError;

        var now = DateTime.UtcNow;
        var provider = new AiProvider
        {
            Id = Guid.NewGuid(),
            Name = request.Name,
            EndpointUrl = request.EndpointUrl,
            ApiKeyEncrypted = encryption.Encrypt(request.ApiKey),
            IsActive = true,
            SortOrder = 0,
            CreatedAt = now,
            UpdatedAt = now
        };

        await repo.CreateAsync(provider, ct);
        return ToResponse(provider);
    }

    public async Task<ErrorOr<AiProviderResponse>> UpdateAsync(Guid id, UpdateAiProviderRequest request, CancellationToken ct)
    {
        var provider = await repo.GetByIdAsync(id, ct);
        if (provider is null)
            return Error.NotFound("NOT_FOUND", "Provider not found.");

        if (request.Name is not null) provider.Name = request.Name;
        if (request.EndpointUrl is not null)
        {
            if (ValidateEndpointUrl(request.EndpointUrl) is { } urlError)
                return urlError;
            provider.EndpointUrl = request.EndpointUrl;
        }
        if (request.ApiKey is not null)
        {
            if (!encryption.IsAvailable)
                return Error.Failure("ENCRYPTION_UNAVAILABLE", "CONFIG_ENCRYPTION_KEY is not configured.");
            provider.ApiKeyEncrypted = encryption.Encrypt(request.ApiKey);
        }
        if (request.IsActive.HasValue) provider.IsActive = request.IsActive.Value;
        if (request.SortOrder.HasValue) provider.SortOrder = request.SortOrder.Value;
        provider.UpdatedAt = DateTime.UtcNow;

        await repo.UpdateAsync(provider, ct);
        return ToResponse(provider);
    }

    public async Task<ErrorOr<Success>> DeleteAsync(Guid id, CancellationToken ct)
    {
        var deleted = await repo.DeleteAsync(id, ct);
        if (!deleted)
            return Error.NotFound("NOT_FOUND", "Provider not found.");
        return Result.Success;
    }

    public async Task<ErrorOr<FetchedModelsResponse>> FetchModelsAsync(Guid id, CancellationToken ct)
    {
        var provider = await repo.GetByIdAsync(id, ct);
        if (provider is null)
            return Error.NotFound("NOT_FOUND", "Provider not found.");

        try
        {
            var apiKey = encryption.Decrypt(provider.ApiKeyEncrypted);
            using var cts = CancellationTokenSource.CreateLinkedTokenSource(ct);
            cts.CancelAfter(TimeSpan.FromSeconds(10));

            var client = OpenAIAgentFactory.CreateOpenAIClient(apiKey, provider.EndpointUrl);
            var modelClient = client.GetOpenAIModelClient();
            var response = await modelClient.GetModelsAsync(cts.Token);

            var models = response.Value
                .Select(m => new FetchedModelItem(m.Id, ReasoningModelDetector.IsReasoningModel(m.Id)))
                .OrderBy(m => m.ModelId, StringComparer.OrdinalIgnoreCase)
                .ToList();

            return new FetchedModelsResponse(models);
        }
        catch (OperationCanceledException)
        {
            return Error.Failure("TIMEOUT", "Connection timed out.");
        }
        catch (ClientResultException ex) when (ex.Status is 401 or 403)
        {
            return Error.Failure("INVALID_KEY", "Invalid API key.");
        }
        catch (Exception ex)
        {
            logger.LogError(ex, "Failed to fetch models for provider {ProviderId}", id);
            return Error.Failure("FETCH_FAILED", ex.Message);
        }
    }

    public async Task<ErrorOr<Success>> ValidateAsync(Guid id, CancellationToken ct)
    {
        var result = await FetchModelsAsync(id, ct);
        if (result.IsError)
            return Error.Failure(result.FirstError.Code, result.FirstError.Description);
        return Result.Success;
    }

    public async Task<ErrorOr<AiProviderModelResponse>> AddModelAsync(
        Guid providerId, AddAiProviderModelRequest request, CancellationToken ct)
    {
        if (ValidateReasoningEffort(request.DefaultReasoningEffort) is { } effortErr)
            return effortErr;

        var provider = await repo.GetByIdAsync(providerId, ct);
        if (provider is null)
            return Error.NotFound("NOT_FOUND", "Provider not found.");

        if (provider.Models.Any(m => m.ModelId == request.ModelId))
            return Error.Conflict("DUPLICATE_MODEL", $"Model '{request.ModelId}' already exists for this provider.");

        var model = new AiProviderModel
        {
            Id = Guid.NewGuid(),
            ProviderId = providerId,
            ModelId = request.ModelId,
            DisplayName = request.DisplayName,
            IsReasoning = request.IsReasoning,
            SupportsFunctionCalling = request.SupportsFunctionCalling,
            SupportsResponseSchema = request.SupportsResponseSchema,
            MaxInputTokens = request.MaxInputTokens,
            MaxOutputTokens = request.MaxOutputTokens,
            DefaultTemperature = request.DefaultTemperature,
            DefaultMaxTokens = request.DefaultMaxTokens,
            DefaultReasoningEffort = request.DefaultReasoningEffort,
            InputCostPerMillion = request.InputCostPerMillion,
            OutputCostPerMillion = request.OutputCostPerMillion,
            IsActive = true,
            SortOrder = provider.Models.Count
        };

        // Auto-fill from LiteLLM registry cache
        var info = await liteLlmCache.TryGetModelInfoAsync(provider.Name, request.ModelId, ct);
        if (info is not null)
        {
            model.InputCostPerMillion ??= info.InputCostPerMillion;
            model.OutputCostPerMillion ??= info.OutputCostPerMillion;
            model.MaxInputTokens ??= info.MaxInputTokens;
            model.MaxOutputTokens ??= info.MaxOutputTokens;
            if (info.IsReasoning == true) model.IsReasoning = true;
            if (info.SupportsFunctionCalling == true) model.SupportsFunctionCalling = true;
            if (info.SupportsResponseSchema == true) model.SupportsResponseSchema = true;
        }

        await repo.AddModelAsync(model, ct);
        return ToModelResponse(model);
    }

    public async Task<ErrorOr<AiProviderModelResponse>> UpdateModelAsync(
        Guid modelId, UpdateAiProviderModelRequest request, CancellationToken ct)
    {
        if (ValidateReasoningEffort(request.DefaultReasoningEffort) is { } effortErr)
            return effortErr;

        var model = await repo.GetModelByIdAsync(modelId, ct);
        if (model is null)
            return Error.NotFound("NOT_FOUND", "Model not found.");

        if (request.DisplayName is not null) model.DisplayName = request.DisplayName;
        if (request.IsReasoning.HasValue) model.IsReasoning = request.IsReasoning.Value;
        if (request.SupportsFunctionCalling.HasValue) model.SupportsFunctionCalling = request.SupportsFunctionCalling.Value;
        if (request.SupportsResponseSchema.HasValue) model.SupportsResponseSchema = request.SupportsResponseSchema.Value;
        if (request.MaxInputTokens.HasValue) model.MaxInputTokens = request.MaxInputTokens.Value;
        if (request.MaxOutputTokens.HasValue) model.MaxOutputTokens = request.MaxOutputTokens.Value;
        if (request.IsActive.HasValue) model.IsActive = request.IsActive.Value;
        if (request.SortOrder.HasValue) model.SortOrder = request.SortOrder.Value;
        if (request.DefaultTemperature.HasValue) model.DefaultTemperature = request.DefaultTemperature.Value;
        if (request.DefaultMaxTokens.HasValue) model.DefaultMaxTokens = request.DefaultMaxTokens.Value;
        if (request.DefaultReasoningEffort is not null) model.DefaultReasoningEffort = request.DefaultReasoningEffort;
        if (request.InputCostPerMillion.HasValue) model.InputCostPerMillion = request.InputCostPerMillion.Value;
        if (request.OutputCostPerMillion.HasValue) model.OutputCostPerMillion = request.OutputCostPerMillion.Value;

        // Auto-enable manual override when cost/context fields are explicitly set
        if (request.InputCostPerMillion.HasValue || request.OutputCostPerMillion.HasValue ||
            request.MaxInputTokens.HasValue || request.MaxOutputTokens.HasValue)
            model.HasManualCostOverride = true;

        // Allow explicit toggle of the override flag
        if (request.HasManualCostOverride.HasValue)
            model.HasManualCostOverride = request.HasManualCostOverride.Value;

        await repo.UpdateModelAsync(model, ct);
        return ToModelResponse(model);
    }

    public async Task<ErrorOr<Success>> DeleteModelAsync(Guid modelId, CancellationToken ct)
    {
        var deleted = await repo.DeleteModelAsync(modelId, ct);
        if (!deleted)
            return Error.NotFound("NOT_FOUND", "Model not found.");
        return Result.Success;
    }

    private static AiProviderResponse ToResponse(AiProvider p) => new(
        p.Id, p.Name, p.EndpointUrl, p.IsActive, p.SortOrder,
        !string.IsNullOrEmpty(p.ApiKeyEncrypted),
        p.Models.Select(ToModelResponse).ToList(),
        p.CreatedAt, p.UpdatedAt
    );

    private static AiProviderModelResponse ToModelResponse(AiProviderModel m) => new(
        m.Id, m.ModelId, m.DisplayName, m.IsReasoning,
        m.SupportsFunctionCalling, m.SupportsResponseSchema,
        m.MaxInputTokens, m.MaxOutputTokens,
        m.DefaultTemperature, m.DefaultMaxTokens, m.DefaultReasoningEffort,
        m.InputCostPerMillion, m.OutputCostPerMillion,
        m.HasManualCostOverride,
        m.IsActive, m.SortOrder
    );

    private static Error? ValidateReasoningEffort(string? effort)
    {
        if (effort is null)
            return null;

        if (!ValidReasoningEfforts.Contains(effort))
            return Error.Validation("INVALID_REASONING_EFFORT",
                "DefaultReasoningEffort must be one of: low, medium, high, extra-high.");

        return null;
    }

    private static Error? ValidateEndpointUrl(string? endpointUrl)
    {
        if (string.IsNullOrWhiteSpace(endpointUrl))
            return null;

        if (!Uri.TryCreate(endpointUrl, UriKind.Absolute, out var uri))
            return Error.Validation("INVALID_ENDPOINT", "Endpoint URL is not a valid URL.");

        // Allow HTTPS always, allow HTTP only for localhost (development)
        if (uri.Scheme == Uri.UriSchemeHttps)
            return null;

        if (uri.Scheme == Uri.UriSchemeHttp && uri.IsLoopback)
            return null;

        return Error.Validation("INSECURE_ENDPOINT",
            "Endpoint URL must use HTTPS. HTTP is only allowed for localhost.");
    }
}
