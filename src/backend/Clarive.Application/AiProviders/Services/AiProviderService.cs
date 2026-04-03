using System.Net.Http.Headers;
using System.Text.Json;
using Clarive.Infrastructure.Security;
using Clarive.Domain.Enums;
using System.ClientModel;
using Clarive.Domain.Errors;
using Clarive.Domain.Entities;
using Clarive.Domain.ValueObjects;
using Clarive.Domain.Interfaces.Repositories;
using Clarive.AI.Agents;
using Clarive.Domain.Interfaces.Services;
using ErrorOr;
using OpenAI;

namespace Clarive.Application.AiProviders.Services;

public class AiProviderService(
    IAiProviderRepository repo,
    IEncryptionService encryption,
    ILiteLlmRegistryCache liteLlmCache,
    IHttpClientFactory httpClientFactory,
    ILogger<AiProviderService> logger
) : IAiProviderService
{
    private static readonly HashSet<string> ValidReasoningEfforts = new(
        StringComparer.OrdinalIgnoreCase
    )
    {
        "low",
        "medium",
        "high",
        "extra-high",
    };

    public async Task<List<AiProviderResponse>> GetAllAsync(CancellationToken ct)
    {
        var providers = await repo.GetAllAsync(ct);
        return providers.Select(ToResponse).ToList();
    }

    public async Task<ErrorOr<AiProviderResponse>> GetByIdAsync(Guid id, CancellationToken ct)
    {
        var provider = await repo.GetByIdAsync(id, ct);
        if (provider is null)
            return DomainErrors.ProviderNotFound;
        return ToResponse(provider);
    }

    public async Task<ErrorOr<AiProviderResponse>> CreateAsync(
        CreateAiProviderRequest request,
        CancellationToken ct
    )
    {
        if (!encryption.IsAvailable)
            return Error.Failure(
                "ENCRYPTION_UNAVAILABLE",
                "CONFIG_ENCRYPTION_KEY is not configured."
            );

        if (ValidateEndpointUrl(request.EndpointUrl) is { } urlError)
            return urlError;
        if (ValidateCustomHeaders(request.CustomHeaders) is { } headersError)
            return headersError;

        var now = DateTime.UtcNow;
        var provider = new AiProvider
        {
            Id = Guid.NewGuid(),
            Name = request.Name,
            EndpointUrl = request.EndpointUrl,
            ApiKeyEncrypted = encryption.Encrypt(request.ApiKey),
            IsActive = true,
            ApiMode =
                ParseApiMode(request.ApiMode)
                ?? (
                    request.Name.Contains("openai", StringComparison.OrdinalIgnoreCase)
                    || request.Name.Contains("azure", StringComparison.OrdinalIgnoreCase)
                        ? AiApiMode.ResponsesApi
                        : AiApiMode.ChatCompletions
                ),
            CustomHeaders = request.CustomHeaders,
            UseProviderPricing = IsOpenRouterEndpoint(request.EndpointUrl),
            SortOrder = 0,
            CreatedAt = now,
            UpdatedAt = now,
        };

        await repo.CreateAsync(provider, ct);
        return ToResponse(provider);
    }

    public async Task<ErrorOr<AiProviderResponse>> UpdateAsync(
        Guid id,
        UpdateAiProviderRequest request,
        CancellationToken ct
    )
    {
        var provider = await repo.GetByIdAsync(id, ct);
        if (provider is null)
            return DomainErrors.ProviderNotFound;

        if (request.Name is not null)
            provider.Name = request.Name;
        if (request.EndpointUrl is not null)
        {
            if (ValidateEndpointUrl(request.EndpointUrl) is { } urlError)
                return urlError;
            provider.EndpointUrl = request.EndpointUrl;
        }
        if (request.ApiKey is not null)
        {
            if (!encryption.IsAvailable)
                return Error.Failure(
                    "ENCRYPTION_UNAVAILABLE",
                    "CONFIG_ENCRYPTION_KEY is not configured."
                );
            provider.ApiKeyEncrypted = encryption.Encrypt(request.ApiKey);
        }
        if (request.IsActive.HasValue)
            provider.IsActive = request.IsActive.Value;
        if (request.SortOrder.HasValue)
            provider.SortOrder = request.SortOrder.Value;
        if (ParseApiMode(request.ApiMode) is { } parsedMode)
            provider.ApiMode = parsedMode;
        if (request.CustomHeaders is not null)
        {
            if (ValidateCustomHeaders(request.CustomHeaders) is { } headersError)
                return headersError;
            provider.CustomHeaders = request.CustomHeaders;
        }
        if (request.EndpointUrl is not null)
            provider.UseProviderPricing = IsOpenRouterEndpoint(request.EndpointUrl);
        provider.UpdatedAt = DateTime.UtcNow;

        await repo.UpdateAsync(provider, ct);
        return ToResponse(provider);
    }

    public async Task<ErrorOr<Success>> DeleteAsync(Guid id, CancellationToken ct)
    {
        var deleted = await repo.DeleteAsync(id, ct);
        if (!deleted)
            return DomainErrors.ProviderNotFound;
        return Result.Success;
    }

    public async Task<ErrorOr<FetchedModelsResponse>> FetchModelsAsync(
        Guid id,
        CancellationToken ct
    )
    {
        var provider = await repo.GetByIdAsync(id, ct);
        if (provider is null)
            return DomainErrors.ProviderNotFound;

        try
        {
            var apiKey = encryption.Decrypt(provider.ApiKeyEncrypted);
            using var cts = CancellationTokenSource.CreateLinkedTokenSource(ct);
            cts.CancelAfter(TimeSpan.FromSeconds(10));

            var client = OpenAIAgentFactory.CreateOpenAIClient(apiKey, provider.EndpointUrl);
            var modelClient = client.GetOpenAIModelClient();
            var response = await modelClient.GetModelsAsync(cts.Token);

            // Fetch provider metadata (pricing + capabilities) when endpoint is configured
            Dictionary<string, ProviderModelMetadata>? providerMetadata = null;
            if (!string.IsNullOrWhiteSpace(provider.EndpointUrl))
            {
                providerMetadata = await FetchProviderMetadataAsync(
                    provider.EndpointUrl,
                    apiKey,
                    cts.Token
                );
            }

            var models = new List<FetchedModelItem>();
            foreach (var m in response.Value.OrderBy(m => m.Id, StringComparer.OrdinalIgnoreCase))
            {
                // Skip known non-chat models (embeddings, audio, image generation, etc.)
                if (liteLlmCache.IsKnownNonChatModel(provider.Name, m.Id))
                    continue;

                var info = await liteLlmCache.TryGetModelInfoAsync(provider.Name, m.Id, ct);
                ProviderModelMetadata? meta = null;
                providerMetadata?.TryGetValue(m.Id, out meta);

                // Skip non-chat models identified by provider metadata (e.g. OpenRouter modality)
                if (meta?.IsChat == false)
                    continue;

                // Merge pricing: provider pricing wins when UseProviderPricing is enabled
                var inputCost = provider.UseProviderPricing && meta?.InputCostPerMillion is not null
                    ? meta.InputCostPerMillion
                    : info?.InputCostPerMillion;
                var outputCost = provider.UseProviderPricing && meta?.OutputCostPerMillion is not null
                    ? meta.OutputCostPerMillion
                    : info?.OutputCostPerMillion;

                // Merge capabilities: OR logic — either source saying true = true
                var supportsFunctionCalling =
                    info?.SupportsFunctionCalling == true || meta?.SupportsFunctionCalling == true;
                var supportsResponseSchema =
                    info?.SupportsResponseSchema == true || meta?.SupportsResponseSchema == true;

                models.Add(
                    new FetchedModelItem(
                        m.Id,
                        info?.IsReasoning == true || ReasoningModelDetector.IsReasoningModel(m.Id),
                        supportsFunctionCalling,
                        supportsResponseSchema,
                        info?.MaxInputTokens,
                        info?.MaxOutputTokens,
                        inputCost,
                        outputCost
                    )
                );
            }

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
        Guid providerId,
        AddAiProviderModelRequest request,
        CancellationToken ct
    )
    {
        if (ValidateReasoningEffort(request.DefaultReasoningEffort) is { } effortErr)
            return effortErr;

        var provider = await repo.GetByIdAsync(providerId, ct);
        if (provider is null)
            return DomainErrors.ProviderNotFound;

        if (provider.Models.Any(m => m.ModelId == request.ModelId))
            return Error.Conflict(
                "DUPLICATE_MODEL",
                $"Model '{request.ModelId}' already exists for this provider."
            );

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
            SortOrder = provider.Models.Count,
        };

        // Auto-fill from LiteLLM registry cache
        var info = await liteLlmCache.TryGetModelInfoAsync(provider.Name, request.ModelId, ct);
        if (info is not null)
        {
            model.InputCostPerMillion ??= info.InputCostPerMillion;
            model.OutputCostPerMillion ??= info.OutputCostPerMillion;
            model.MaxInputTokens ??= info.MaxInputTokens;
            model.MaxOutputTokens ??= info.MaxOutputTokens;
            if (info.IsReasoning == true)
                model.IsReasoning = true;
            if (info.SupportsFunctionCalling == true)
                model.SupportsFunctionCalling = true;
            if (info.SupportsResponseSchema == true)
                model.SupportsResponseSchema = true;
        }

        await repo.AddModelAsync(model, ct);
        return ToModelResponse(model);
    }

    public async Task<ErrorOr<AiProviderModelResponse>> UpdateModelAsync(
        Guid modelId,
        UpdateAiProviderModelRequest request,
        CancellationToken ct
    )
    {
        if (ValidateReasoningEffort(request.DefaultReasoningEffort) is { } effortErr)
            return effortErr;

        var model = await repo.GetModelByIdAsync(modelId, ct);
        if (model is null)
            return DomainErrors.AiModelNotFound;

        if (request.DisplayName is not null)
            model.DisplayName = request.DisplayName;
        if (request.IsReasoning.HasValue)
            model.IsReasoning = request.IsReasoning.Value;
        if (request.SupportsFunctionCalling.HasValue)
            model.SupportsFunctionCalling = request.SupportsFunctionCalling.Value;
        if (request.SupportsResponseSchema.HasValue)
            model.SupportsResponseSchema = request.SupportsResponseSchema.Value;
        if (request.MaxInputTokens.HasValue)
            model.MaxInputTokens = request.MaxInputTokens.Value;
        if (request.MaxOutputTokens.HasValue)
            model.MaxOutputTokens = request.MaxOutputTokens.Value;
        if (request.IsActive.HasValue)
            model.IsActive = request.IsActive.Value;
        if (request.SortOrder.HasValue)
            model.SortOrder = request.SortOrder.Value;
        if (request.DefaultTemperature.HasValue)
            model.DefaultTemperature = request.DefaultTemperature.Value;
        if (request.DefaultMaxTokens.HasValue)
            model.DefaultMaxTokens = request.DefaultMaxTokens.Value;
        if (request.DefaultReasoningEffort is not null)
            model.DefaultReasoningEffort = request.DefaultReasoningEffort;
        if (request.InputCostPerMillion.HasValue)
            model.InputCostPerMillion = request.InputCostPerMillion.Value;
        if (request.OutputCostPerMillion.HasValue)
            model.OutputCostPerMillion = request.OutputCostPerMillion.Value;

        // Auto-enable manual override when cost/context fields are explicitly set
        if (
            request.InputCostPerMillion.HasValue
            || request.OutputCostPerMillion.HasValue
            || request.MaxInputTokens.HasValue
            || request.MaxOutputTokens.HasValue
        )
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
            return DomainErrors.AiModelNotFound;
        return Result.Success;
    }

    private record ProviderModelMetadata(
        decimal? InputCostPerMillion,
        decimal? OutputCostPerMillion,
        bool? SupportsFunctionCalling,
        bool? SupportsResponseSchema,
        bool? IsChat
    );

    private async Task<Dictionary<string, ProviderModelMetadata>?> FetchProviderMetadataAsync(
        string endpointUrl,
        string apiKey,
        CancellationToken ct
    )
    {
        try
        {
            // Block requests to private/internal networks
            if (
                Uri.TryCreate(endpointUrl, UriKind.Absolute, out var uri)
                && System.Net.IPAddress.TryParse(uri.Host, out var ip)
                && (System.Net.IPAddress.IsLoopback(ip) || IsPrivateIp(ip))
            )
            {
                logger.LogWarning(
                    "Blocked provider pricing fetch to private IP: {Url}",
                    endpointUrl
                );
                return null;
            }

            using var httpClient = httpClientFactory.CreateClient();
            httpClient.Timeout = TimeSpan.FromSeconds(10);
            httpClient.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue(
                "Bearer",
                apiKey
            );

            // Normalize endpoint: ensure /models path
            var baseUrl = endpointUrl.TrimEnd('/');
            var modelsUrl = baseUrl.EndsWith("/models", StringComparison.OrdinalIgnoreCase)
                ? baseUrl
                : $"{baseUrl}/models";

            var json = await httpClient.GetStringAsync(modelsUrl, ct);
            using var doc = JsonDocument.Parse(json);

            var result = new Dictionary<string, ProviderModelMetadata>(
                StringComparer.OrdinalIgnoreCase
            );

            if (doc.RootElement.TryGetProperty("data", out var dataArray))
            {
                foreach (var model in dataArray.EnumerateArray())
                {
                    if (!model.TryGetProperty("id", out var idProp))
                        continue;

                    var modelId = idProp.GetString();
                    if (string.IsNullOrEmpty(modelId))
                        continue;

                    // Parse pricing: { prompt: "0.000003", completion: "0.000015" } (per-token, USD)
                    decimal? inputCost = null;
                    decimal? outputCost = null;
                    if (
                        model.TryGetProperty("pricing", out var pricingProp)
                        && pricingProp.TryGetProperty("prompt", out var promptProp)
                        && pricingProp.TryGetProperty("completion", out var completionProp)
                        && decimal.TryParse(
                            promptProp.GetString(),
                            System.Globalization.NumberStyles.Float,
                            System.Globalization.CultureInfo.InvariantCulture,
                            out var promptPerToken
                        )
                        && decimal.TryParse(
                            completionProp.GetString(),
                            System.Globalization.NumberStyles.Float,
                            System.Globalization.CultureInfo.InvariantCulture,
                            out var completionPerToken
                        )
                    )
                    {
                        inputCost = promptPerToken * 1_000_000m;
                        outputCost = completionPerToken * 1_000_000m;
                    }

                    // Parse capabilities from supported_parameters array
                    bool? supportsFunctionCalling = null;
                    bool? supportsResponseSchema = null;
                    if (model.TryGetProperty("supported_parameters", out var paramsArray))
                    {
                        var paramSet = new HashSet<string>(StringComparer.OrdinalIgnoreCase);
                        foreach (var param in paramsArray.EnumerateArray())
                        {
                            var p = param.GetString();
                            if (p is not null)
                                paramSet.Add(p);
                        }

                        if (paramSet.Contains("tools") || paramSet.Contains("tool_choice"))
                            supportsFunctionCalling = true;
                        if (
                            paramSet.Contains("structured_output")
                            || paramSet.Contains("response_format")
                        )
                            supportsResponseSchema = true;
                    }

                    // Determine if this is a chat model from architecture.modality
                    // e.g. "text->text", "text+image->text" are chat; "text->image", "text->audio" are not
                    bool? isChat = null;
                    if (
                        model.TryGetProperty("architecture", out var archProp)
                        && archProp.TryGetProperty("modality", out var modalityProp)
                        && modalityProp.GetString() is string modality
                    )
                    {
                        isChat = modality.EndsWith("->text", StringComparison.OrdinalIgnoreCase);
                    }

                    result[modelId] = new ProviderModelMetadata(
                        inputCost,
                        outputCost,
                        supportsFunctionCalling,
                        supportsResponseSchema,
                        isChat
                    );
                }
            }

            return result.Count > 0 ? result : null;
        }
        catch (Exception ex)
        {
            logger.LogWarning(
                ex,
                "Failed to fetch provider pricing from {EndpointUrl} — falling back to LiteLLM",
                endpointUrl
            );
            return null;
        }
    }

    private static AiApiMode? ParseApiMode(string? value) =>
        value is not null
        && Enum.TryParse<AiApiMode>(value, ignoreCase: true, out var mode)
            ? mode
            : null;

    private static AiProviderResponse ToResponse(AiProvider p) =>
        new(
            p.Id,
            p.Name,
            p.EndpointUrl,
            p.IsActive,
            p.ApiMode.ToString(),
            p.CustomHeaders,
            p.UseProviderPricing,
            p.SortOrder,
            !string.IsNullOrEmpty(p.ApiKeyEncrypted),
            p.Models.Select(ToModelResponse).ToList(),
            p.CreatedAt,
            p.UpdatedAt
        );

    private static AiProviderModelResponse ToModelResponse(AiProviderModel m) =>
        new(
            m.Id,
            m.ModelId,
            m.DisplayName,
            m.IsReasoning,
            m.SupportsFunctionCalling,
            m.SupportsResponseSchema,
            m.MaxInputTokens,
            m.MaxOutputTokens,
            m.DefaultTemperature,
            m.DefaultMaxTokens,
            m.DefaultReasoningEffort,
            m.InputCostPerMillion,
            m.OutputCostPerMillion,
            m.HasManualCostOverride,
            m.IsActive,
            m.SortOrder
        );

    private static Error? ValidateReasoningEffort(string? effort)
    {
        if (effort is null)
            return null;

        if (!ValidReasoningEfforts.Contains(effort))
            return Error.Validation(
                "INVALID_REASONING_EFFORT",
                "DefaultReasoningEffort must be one of: low, medium, high, extra-high."
            );

        return null;
    }

    private const int MaxCustomHeaders = 20;
    private const int MaxHeaderKeyLength = 256;
    private const int MaxHeaderValueLength = 4096;

    private static Error? ValidateCustomHeaders(Dictionary<string, string>? headers)
    {
        if (headers is null or { Count: 0 })
            return null;

        if (headers.Count > MaxCustomHeaders)
            return Error.Validation(
                "TOO_MANY_HEADERS",
                $"Maximum {MaxCustomHeaders} custom headers allowed."
            );

        foreach (var (key, value) in headers)
        {
            if (key.Length > MaxHeaderKeyLength)
                return Error.Validation(
                    "HEADER_KEY_TOO_LONG",
                    $"Header name '{key[..50]}...' exceeds {MaxHeaderKeyLength} characters."
                );
            if (value.Length > MaxHeaderValueLength)
                return Error.Validation(
                    "HEADER_VALUE_TOO_LONG",
                    $"Header value for '{key}' exceeds {MaxHeaderValueLength} characters."
                );
            if (key.Contains('\r') || key.Contains('\n') || value.Contains('\r') || value.Contains('\n'))
                return Error.Validation(
                    "INVALID_HEADER",
                    $"Header '{key}' contains invalid characters (CR/LF)."
                );
        }

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

        return Error.Validation(
            "INSECURE_ENDPOINT",
            "Endpoint URL must use HTTPS. HTTP is only allowed for localhost."
        );
    }

    private static bool IsOpenRouterEndpoint(string? endpointUrl) =>
        endpointUrl is not null
        && endpointUrl.Contains("openrouter.ai", StringComparison.OrdinalIgnoreCase);

    private static bool IsPrivateIp(System.Net.IPAddress ip)
    {
        var bytes = ip.GetAddressBytes();
        return bytes is [10, ..]
            or [172, >= 16 and <= 31, ..]
            or [192, 168, ..]
            or [169, 254, ..];
    }
}
