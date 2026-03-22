using Clarive.AI.Configuration;
using Clarive.Application.ApiKeys.Contracts;
using Clarive.Application.ApiKeys.Services;
using Clarive.Application.McpServers.Contracts;
using Clarive.Application.McpServers.Services;
using Clarive.Application.Tags.Contracts;
using Clarive.Application.Tags.Services;
using Clarive.Domain.Interfaces.Services;

namespace Clarive.Application;

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
        services.AddScoped<IEntryVersionService, EntryVersionService>();
        services.AddScoped<IEntryActivityService, EntryActivityService>();
        services.AddScoped<IEntryTagService, EntryTagService>();
        services.AddScoped<IEntryFavoriteService, EntryFavoriteService>();
        services.AddScoped<ITokenIssuanceService, TokenIssuanceService>();
        services.AddScoped<IUserWorkspaceCreationService, UserWorkspaceCreationService>();
        services.AddScoped<IAccountService, AccountService>();
        services.AddScoped<IInvitationService, InvitationService>();
        services.AddScoped<IAiGenerationService, AiGenerationService>();
        services.AddScoped<IUserManagementService, UserManagementService>();
        services.AddScoped<IAuthService, AuthService>();
        services.AddScoped<IProfileService, ProfileService>();
        services.AddScoped<IImportExportService, ImportExportService>();
        services.AddScoped<IDashboardService, DashboardService>();
        services.AddScoped<IFolderService, FolderService>();
        services.AddScoped<IModelResolutionService, ModelResolutionService>();
        services.AddScoped<IPlaygroundRunService, PlaygroundRunService>();
        services.AddScoped<ISuperAdminService, SuperAdminService>();
        services.AddScoped<IPlaygroundService, PlaygroundService>();
        services.AddScoped<IAiProviderService, AiProviderService>();
        services.AddScoped<IAiUsageLogger, AiUsageLogger>();
        services.AddScoped<IShareLinkService, ShareLinkService>();
        services.AddScoped<ITagService, TagService>();
        services.AddScoped<IApiKeyService, ApiKeyService>();
        services.Configure<AvatarSettings>(configuration.GetSection("Avatar"));
        services.AddScoped<IAvatarService, AvatarService>();
        services.AddScoped<IOnboardingSeeder, OnboardingSeeder>();
        services.AddScoped<IMcpImportService, McpImportService>();
        services.AddScoped<IMcpServerService, McpServerService>();
        services.AddScoped<IMcpToolProvider, McpToolProvider>();
        services.AddSingleton<ITavilyClientService, TavilyClientService>();
        services.AddSingleton<ILiteLlmRegistryCache, LiteLlmRegistryCache>();

        // ── Settings ──
        services.Configure<AppSettings>(configuration.GetSection("App"));

        // ── Background Services ──
        services.AddHostedService<AccountPurgeBackgroundService>();
        services.AddHostedService<MaintenanceModeSyncService>();
        services.AddHostedService<LiteLlmSyncService>();
        services.AddHostedService<McpSyncBackgroundService>();

        return services;
    }
}
