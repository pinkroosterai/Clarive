namespace Clarive.Api.Models.Responses;

/// <summary>
/// Source indicates where the effective value comes from:
/// "none" = not configured anywhere,
/// "environment" = from env var / appsettings,
/// "dashboard" = overridden via super user dashboard (DB).
/// </summary>
public record ConfigSettingResponse(
    string Key,
    string Label,
    string Description,
    string Section,
    bool IsSecret,
    bool RequiresRestart,
    string? ValidationHint,
    string? Value,
    bool IsOverridden,
    bool IsConfigured,
    string Source,
    string InputType,
    string[]? SelectOptions,
    string? SubGroup,
    ConfigVisibleWhenResponse? VisibleWhen);

public record ConfigVisibleWhenResponse(string Key, string[] Values);
