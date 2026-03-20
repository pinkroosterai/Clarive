using Clarive.AI.Services;
using Clarive.Core.Endpoints;
using Clarive.Core.Services;
using Clarive.Core.Services.Background;
using Clarive.Core.Services.Interfaces;
using Clarive.Domain.Interfaces.Services;

namespace Clarive.Core;

public static class DependencyInjection
{
    public static IServiceCollection AddClariveCore(
        this IServiceCollection services,
        IConfiguration configuration)
    {
        // ── Services ──
        services.AddSingleton<MaintenanceModeService>();
        services.AddSingleton<IMaintenanceModeService>(sp =>
            sp.GetRequiredService<MaintenanceModeService>()
        );
        services.AddScoped<IAuditLogger, AuditLogger>();
        services.AddScoped<IEntryService, EntryService>();
        services.AddScoped<IAccountService, AccountService>();
        services.AddScoped<IInvitationService, InvitationService>();
        services.AddScoped<IAiGenerationService, AiGenerationService>();
        services.AddScoped<IUserManagementService, UserManagementService>();
        services.AddScoped<IAuthService, AuthService>();
        services.AddScoped<IProfileService, ProfileService>();
        services.AddScoped<IImportExportService, ImportExportService>();
        services.AddScoped<IFolderService, FolderService>();
        services.AddScoped<IModelResolutionService, ModelResolutionService>();
        services.AddScoped<IPlaygroundRunService, PlaygroundRunService>();
        services.AddScoped<ISuperAdminService, SuperAdminService>();
        services.AddScoped<IPlaygroundService, PlaygroundService>();
        services.AddScoped<IAiProviderService, AiProviderService>();
        services.AddScoped<IAiUsageLogger, AiUsageLogger>();
        services.AddScoped<IShareLinkService, ShareLinkService>();
        services.Configure<AvatarSettings>(configuration.GetSection("Avatar"));
        services.AddScoped<IAvatarService, AvatarService>();
        services.AddScoped<IOnboardingSeeder, OnboardingSeeder>();
        services.AddScoped<IMcpImportService, McpImportService>();
        services.AddSingleton<ITavilyClientService, TavilyClientService>();
        services.AddSingleton<ILiteLlmRegistryCache, LiteLlmRegistryCache>();

        // ── Settings ──
        services.Configure<AppSettings>(configuration.GetSection("App"));

        // ── Background Services ──
        services.AddHostedService<AccountPurgeBackgroundService>();
        services.AddHostedService<MaintenanceModeSyncService>();
        services.AddHostedService<LiteLlmSyncService>();

        return services;
    }

    public static WebApplication MapClariveEndpoints(this WebApplication app)
    {
        app.MapAuthEndpoints();
        app.MapFolderEndpoints();
        app.MapEntryEndpoints();
        app.MapToolEndpoints();
        app.MapApiKeyEndpoints();
        app.MapUserEndpoints();
        app.MapInvitationEndpoints();
        app.MapTenantEndpoints();
        app.MapWorkspaceEndpoints();
        app.MapAuditLogEndpoints();
        app.MapPublicApiEndpoints();
        app.MapImportExportEndpoints();
        app.MapAiGenerationEndpoints();
        app.MapAccountEndpoints();
        app.MapProfileEndpoints();
        app.MapDashboardEndpoints();
        app.MapTagEndpoints();
        app.MapSuperEndpoints();
        app.MapConfigEndpoints();
        app.MapPlaygroundEndpoints();
        app.MapAiProviderEndpoints();
        app.MapAiUsageEndpoints();
        app.MapShareLinkEndpoints();
        app.MapPublicShareEndpoints();
        app.MapSystemLogEndpoints();

        return app;
    }
}
