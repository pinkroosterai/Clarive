using System.ClientModel;
using Clarive.Api.Data;
using Clarive.Api.Models.Entities;
using Clarive.Api.Models.Requests;
using Clarive.Api.Models.Responses;
using Clarive.Api.Services;
using Clarive.Api.Services.Agents;
using Microsoft.EntityFrameworkCore;
using Clarive.Api.Auth;
using OpenAI;

namespace Clarive.Api.Endpoints;

public static class ConfigEndpoints
{
    public static RouteGroupBuilder MapConfigEndpoints(this IEndpointRouteBuilder app)
    {
        var group = app.MapGroup("/api/super/config")
            .WithTags("Service Configuration")
            .RequireAuthorization("SuperUser");

        group.MapGet("/", HandleGetAll);
        group.MapPut("/{key}", HandleSetValue);
        group.MapDelete("/{key}", HandleDeleteValue);
        group.MapPost("/validate-ai", HandleValidateAi);
        group.MapPost("/ai-models", HandleGetAiModels);

        return group;
    }

    private static async Task<IResult> HandleGetAll(
        ClariveDbContext db,
        IConfiguration configuration,
        IEncryptionService encryption,
        CancellationToken ct)
    {
        Dictionary<string, ServiceConfig> overrides;
        try
        {
            overrides = await db.ServiceConfigs
                .AsNoTracking()
                .ToDictionaryAsync(c => c.Key, c => c, ct);
        }
        catch
        {
            // Table may not exist yet if migration hasn't been applied
            overrides = new Dictionary<string, ServiceConfig>();
        }

        var result = ConfigRegistry.All.Select(def =>
        {
            var hasOverride = overrides.ContainsKey(def.Key);
            string? value = null;
            var effectiveValue = configuration[def.Key];

            if (!def.IsSecret)
            {
                // Use DB value directly when override exists (IConfiguration may not have reloaded yet)
                if (hasOverride && !overrides[def.Key].IsEncrypted)
                    value = overrides[def.Key].EncryptedValue;
                else
                    value = effectiveValue ?? "";
            }

            // Determine if the setting has any value from any source
            bool isConfigured;
            if (def.IsSecret)
            {
                // For secrets: configured if there's a DB override OR the env var is non-empty
                isConfigured = hasOverride || !string.IsNullOrEmpty(effectiveValue);
            }
            else
            {
                isConfigured = !string.IsNullOrEmpty(effectiveValue);
            }

            // Source: "dashboard" if DB override, "environment" if env var provides value, "none" otherwise
            var source = hasOverride ? "dashboard"
                : isConfigured ? "environment"
                : "none";

            return new ConfigSettingResponse(
                Key: def.Key,
                Label: def.Label,
                Description: def.Description,
                Section: def.Section.ToString(),
                IsSecret: def.IsSecret,
                RequiresRestart: def.RequiresRestart,
                ValidationHint: def.ValidationHint,
                Value: value,
                IsOverridden: hasOverride,
                IsConfigured: isConfigured,
                Source: source,
                InputType: def.InputType.ToString().ToLowerInvariant(),
                SelectOptions: def.SelectOptions,
                SubGroup: def.SubGroup,
                VisibleWhen: def.VisibleWhen is not null
                    ? new ConfigVisibleWhenResponse(def.VisibleWhen.Key, def.VisibleWhen.Values)
                    : null);
        }).ToList();

        return Results.Ok(result);
    }

    private static async Task<IResult> HandleSetValue(
        string key,
        SetConfigValueRequest request,
        HttpContext ctx,
        ClariveDbContext db,
        IEncryptionService encryption,
        CancellationToken ct)
    {
        key = Uri.UnescapeDataString(key);

        if (!ConfigRegistry.ByKey.TryGetValue(key, out var def))
            return Results.NotFound(new
            {
                error = new { code = "CONFIG_KEY_NOT_FOUND", message = $"Unknown config key: {key}" }
            });

        if (string.IsNullOrEmpty(request.Value))
            return Results.BadRequest(new
            {
                error = new { code = "EMPTY_VALUE", message = "Value cannot be empty. Use DELETE to reset to default." }
            });

        if (def.IsSecret && !encryption.IsAvailable)
            return Results.BadRequest(new
            {
                error = new
                {
                    code = "ENCRYPTION_UNAVAILABLE",
                    message = "CONFIG_ENCRYPTION_KEY is not configured — cannot store secret values."
                }
            });

        string storedValue;
        bool isEncrypted;

        if (def.IsSecret)
        {
            storedValue = encryption.Encrypt(request.Value);
            isEncrypted = true;
        }
        else
        {
            storedValue = request.Value;
            isEncrypted = false;
        }

        var now = DateTime.UtcNow;
        var userName = ctx.GetUserName();

        var existing = await db.ServiceConfigs.FindAsync([key], ct);
        if (existing is not null)
        {
            existing.EncryptedValue = storedValue;
            existing.IsEncrypted = isEncrypted;
            existing.UpdatedAt = now;
            existing.UpdatedBy = userName;
        }
        else
        {
            db.ServiceConfigs.Add(new ServiceConfig
            {
                Key = key,
                EncryptedValue = storedValue,
                IsEncrypted = isEncrypted,
                UpdatedAt = now,
                UpdatedBy = userName
            });
        }

        await db.SaveChangesAsync(ct);

        return Results.Ok(new { key, updated = true, requiresRestart = def.RequiresRestart });
    }

    private static async Task<IResult> HandleDeleteValue(
        string key,
        ClariveDbContext db,
        CancellationToken ct)
    {
        key = Uri.UnescapeDataString(key);

        if (!ConfigRegistry.ByKey.ContainsKey(key))
            return Results.NotFound(new
            {
                error = new { code = "CONFIG_KEY_NOT_FOUND", message = $"Unknown config key: {key}" }
            });

        var existing = await db.ServiceConfigs.FindAsync([key], ct);
        if (existing is null)
            return Results.Ok(new { key, reset = true });

        db.ServiceConfigs.Remove(existing);
        await db.SaveChangesAsync(ct);

        return Results.Ok(new { key, reset = true });
    }

    private static readonly string[] OpenAiChatPrefixes = ["gpt-", "o1-", "o3-", "o4-", "chatgpt-"];

    private static async Task<IResult> HandleValidateAi(
        ValidateAiConfigRequest request,
        IConfiguration configuration,
        CancellationToken ct)
    {
        var apiKey = !string.IsNullOrWhiteSpace(request.ApiKey)
            ? request.ApiKey
            : configuration["Ai:OpenAiApiKey"];

        if (string.IsNullOrWhiteSpace(apiKey))
            return Results.BadRequest(new ValidateAiConfigResponse(false, "API key is required"));

        var endpointUrl = !string.IsNullOrWhiteSpace(request.EndpointUrl)
            ? request.EndpointUrl
            : configuration["Ai:EndpointUrl"];

        try
        {
            using var cts = CancellationTokenSource.CreateLinkedTokenSource(ct);
            cts.CancelAfter(TimeSpan.FromSeconds(10));

            var client = OpenAIAgentFactory.CreateOpenAIClient(apiKey, endpointUrl);
            var modelClient = client.GetOpenAIModelClient();
            await modelClient.GetModelsAsync(cts.Token);

            return Results.Ok(new ValidateAiConfigResponse(true));
        }
        catch (OperationCanceledException)
        {
            return Results.Ok(new ValidateAiConfigResponse(false, "Connection timed out — check the endpoint URL"));
        }
        catch (ClientResultException ex) when (ex.Status is 401 or 403)
        {
            return Results.Ok(new ValidateAiConfigResponse(false, "Invalid API key"));
        }
        catch (Exception ex)
        {
            return Results.Ok(new ValidateAiConfigResponse(false, $"Connection failed: {ex.Message}"));
        }
    }

    private static async Task<IResult> HandleGetAiModels(
        GetAiModelsRequest request,
        IConfiguration configuration,
        CancellationToken ct)
    {
        var apiKey = !string.IsNullOrWhiteSpace(request.ApiKey)
            ? request.ApiKey
            : configuration["Ai:OpenAiApiKey"];

        if (string.IsNullOrWhiteSpace(apiKey))
            return Results.BadRequest(new { error = new { code = "NO_API_KEY", message = "No API key configured" } });

        var endpointUrl = !string.IsNullOrWhiteSpace(request.EndpointUrl)
            ? request.EndpointUrl
            : configuration["Ai:EndpointUrl"];

        try
        {
            using var cts = CancellationTokenSource.CreateLinkedTokenSource(ct);
            cts.CancelAfter(TimeSpan.FromSeconds(10));

            var client = OpenAIAgentFactory.CreateOpenAIClient(apiKey, endpointUrl);
            var modelClient = client.GetOpenAIModelClient();
            var response = await modelClient.GetModelsAsync(cts.Token);

            var isOpenAi = string.IsNullOrWhiteSpace(endpointUrl)
                || endpointUrl.Contains("api.openai.com", StringComparison.OrdinalIgnoreCase);

            var models = response.Value
                .Select(m => m.Id)
                .Where(id =>
                {
                    if (!isOpenAi) return true;
                    return OpenAiChatPrefixes.Any(prefix =>
                        id.StartsWith(prefix, StringComparison.OrdinalIgnoreCase));
                })
                .OrderBy(id => id, StringComparer.OrdinalIgnoreCase)
                .ToList();

            return Results.Ok(new GetAiModelsResponse(models));
        }
        catch (OperationCanceledException)
        {
            return Results.BadRequest(new { error = new { code = "TIMEOUT", message = "Connection timed out" } });
        }
        catch (Exception ex)
        {
            return Results.BadRequest(new { error = new { code = "MODEL_FETCH_FAILED", message = ex.Message } });
        }
    }
}
