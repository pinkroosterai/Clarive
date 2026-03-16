using Clarive.Api.Models.Entities;
using Clarive.Api.Models.Requests;
using Clarive.Api.Models.Responses;
using Clarive.Api.Repositories.Interfaces;
using Clarive.Api.Services;
using Microsoft.Extensions.Caching.Memory;
using Clarive.Api.Auth;

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

        // Public setup-status endpoint (no auth required)
        app.MapGet("/api/super/setup-status", HandleSetupStatus)
            .WithTags("Service Configuration")
            .AllowAnonymous();

        return group;
    }

    private static async Task<IResult> HandleSetupStatus(
        IAiProviderRepository aiProviderRepo,
        IServiceConfigRepository configRepo,
        IConfiguration configuration,
        CancellationToken ct)
    {
        var unconfigured = new List<string>();

        // Check if any AI provider is configured
        var providers = await aiProviderRepo.GetAllAsync(ct);
        if (providers.Count == 0)
            unconfigured.Add("ai");

        // Check if email provider is configured (not 'none')
        var emailProvider = configuration["Email:Provider"] ?? "none";
        if (string.Equals(emailProvider, "none", StringComparison.OrdinalIgnoreCase))
            unconfigured.Add("email");

        // Only require setup on truly fresh installs — if ANY config has been
        // saved to the DB, the admin has already been through setup (or configured
        // via Super Admin settings). AI and email are optional.
        var dbOverrides = await configRepo.GetAllAsync(ct);
        var hasAnyDbConfig = dbOverrides.Count > 0 || providers.Count > 0;

        return Results.Ok(new
        {
            requiresSetup = !hasAnyDbConfig,
            unconfiguredSections = unconfigured
        });
    }

    private static async Task<IResult> HandleGetAll(
        IServiceConfigRepository configRepo,
        IConfiguration configuration,
        IEncryptionService encryption,
        CancellationToken ct)
    {
        var overrides = await configRepo.GetAllAsync(ct);

        var result = ConfigRegistry.All
            .Select(def => ResolveConfigSetting(def, overrides, configuration))
            .ToList();

        return Results.Ok(result);
    }

    private static ConfigSettingResponse ResolveConfigSetting(
        ConfigDefinition def,
        Dictionary<string, ServiceConfig> overrides,
        IConfiguration configuration)
    {
        var hasOverride = overrides.ContainsKey(def.Key);
        var effectiveValue = configuration[def.Key];

        // Resolve displayed value (secrets are never exposed)
        string? value = null;
        if (!def.IsSecret)
        {
            value = hasOverride && !overrides[def.Key].IsEncrypted
                ? overrides[def.Key].EncryptedValue
                : effectiveValue ?? "";
        }

        // For secrets: configured only if there's a DB override (env vars removed)
        var isConfigured = def.IsSecret
            ? hasOverride
            : !string.IsNullOrEmpty(effectiveValue);

        var source = hasOverride ? "dashboard"
            : isConfigured ? "default"
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
    }

    private static async Task<IResult> HandleSetValue(
        string key,
        SetConfigValueRequest request,
        HttpContext ctx,
        IServiceConfigRepository configRepo,
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

        await configRepo.CreateOrUpdateAsync(new ServiceConfig
        {
            Key = key,
            EncryptedValue = storedValue,
            IsEncrypted = isEncrypted,
            UpdatedAt = DateTime.UtcNow,
            UpdatedBy = ctx.GetUserName()
        }, ct);

        // Invalidate playground model cache when AI config changes
        if (key.StartsWith("Ai:", StringComparison.OrdinalIgnoreCase))
        {
            var memoryCache = ctx.RequestServices.GetRequiredService<IMemoryCache>();
            memoryCache.Remove("playground_available_models");
            memoryCache.Remove("playground_enriched_models");
            memoryCache.Remove("ai_providers_all");
        }

        return Results.Ok(new { key, updated = true, requiresRestart = def.RequiresRestart });
    }

    private static async Task<IResult> HandleDeleteValue(
        string key,
        HttpContext ctx,
        IServiceConfigRepository configRepo,
        CancellationToken ct)
    {
        key = Uri.UnescapeDataString(key);

        if (!ConfigRegistry.ByKey.ContainsKey(key))
            return Results.NotFound(new
            {
                error = new { code = "CONFIG_KEY_NOT_FOUND", message = $"Unknown config key: {key}" }
            });

        await configRepo.DeleteByKeyAsync(key, ct);

        // Invalidate playground model cache when AI config changes
        if (key.StartsWith("Ai:", StringComparison.OrdinalIgnoreCase))
        {
            var memoryCache = ctx.RequestServices.GetRequiredService<IMemoryCache>();
            memoryCache.Remove("playground_available_models");
            memoryCache.Remove("playground_enriched_models");
            memoryCache.Remove("ai_providers_all");
        }

        return Results.Ok(new { key, reset = true });
    }

}
