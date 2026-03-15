using System.Data.Common;
using Clarive.Api.Data;
using Clarive.Api.Models.Entities;
using Clarive.Api.Models.Requests;
using Clarive.Api.Models.Responses;
using Clarive.Api.Services;
using Microsoft.EntityFrameworkCore;
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
        catch (DbException)
        {
            // Table may not exist yet if migration hasn't been applied
            overrides = new Dictionary<string, ServiceConfig>();
        }

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

        // For secrets: configured if there's a DB override OR the env var is non-empty
        var isConfigured = def.IsSecret
            ? hasOverride || !string.IsNullOrEmpty(effectiveValue)
            : !string.IsNullOrEmpty(effectiveValue);

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
