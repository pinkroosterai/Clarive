using Clarive.AI.Configuration;
using Clarive.Application.ApiKeys.Contracts;
using Clarive.Application.ApiKeys.Services;
using Clarive.Application.McpServers.Contracts;
using Clarive.Application.McpServers.Services;
using Clarive.Application.Tags.Contracts;
using Clarive.Application.Tags.Services;
using Clarive.Domain.Interfaces.Services;
using Quartz;

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
        services.AddScoped<IJobHistoryService, JobHistoryService>();
        services.AddScoped<IPlaygroundService, PlaygroundService>();
        services.AddScoped<IAiProviderService, AiProviderService>();
        services.AddScoped<IAiUsageLogger, AiUsageLogger>();
        services.AddScoped<IShareLinkService, ShareLinkService>();
        services.AddScoped<ITagService, TagService>();
        services.AddScoped<IApiKeyService, ApiKeyService>();
        services.AddScoped<ITestDatasetService, TestDatasetService>();
        services.AddScoped<IAbTestService, AbTestService>();
        services.AddScoped<ITabService, TabService>();
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

        // ── Quartz Jobs (Application layer — scheduler configured in Infrastructure) ──
        services.AddQuartz(q =>
        {
            q.AddJob<AccountPurgeJob>(opts => opts
                .WithIdentity("AccountPurge", "Application")
                .StoreDurably());
            q.AddTrigger(opts => opts
                .ForJob("AccountPurge", "Application")
                .WithIdentity("AccountPurge-trigger")
                .WithCronSchedule("0 0 2 * * ?"));

            q.AddJob<MaintenanceSyncJob>(opts => opts
                .WithIdentity("MaintenanceSync", "Application")
                .StoreDurably());
            q.AddTrigger(opts => opts
                .ForJob("MaintenanceSync", "Application")
                .WithIdentity("MaintenanceSync-trigger")
                .WithCronSchedule("*/10 * * * * ?",
                    x => x.WithMisfireHandlingInstructionDoNothing()));

            q.AddJob<LiteLlmSyncJob>(opts => opts
                .WithIdentity("LiteLlmSync", "Application")
                .StoreDurably());
            q.AddTrigger(opts => opts
                .ForJob("LiteLlmSync", "Application")
                .WithIdentity("LiteLlmSync-trigger")
                .StartNow()
                .WithCronSchedule("0 0 1 * * ?"));

            q.AddJob<McpSyncJob>(opts => opts
                .WithIdentity("McpSync", "Application")
                .StoreDurably());
            q.AddTrigger(opts => opts
                .ForJob("McpSync", "Application")
                .WithIdentity("McpSync-trigger")
                .WithCronSchedule("0 */5 * * * ?"));
        });

        return services;
    }
}
