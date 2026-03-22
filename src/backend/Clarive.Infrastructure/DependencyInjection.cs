using Clarive.Domain.Interfaces.Repositories;
using Clarive.Domain.Interfaces.Services;
using Clarive.Infrastructure.BackgroundJobs;
using Clarive.Infrastructure.Cache;
using Clarive.Infrastructure.Data;
using Clarive.Infrastructure.Email;
using Clarive.Infrastructure.Repositories;
using Clarive.Infrastructure.Presence;
using Clarive.Infrastructure.Security;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Diagnostics;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Options;
using Npgsql;
using Quartz;
using Quartz.Impl.Matchers;
using Resend;
using ZiggyCreatures.Caching.Fusion;
using ZiggyCreatures.Caching.Fusion.Serialization.SystemTextJson;

namespace Clarive.Infrastructure;

public static class DependencyInjection
{
    public static IServiceCollection AddClariveInfrastructure(
        this IServiceCollection services,
        IConfiguration configuration)
    {
        var connectionString = configuration.GetConnectionString("DefaultConnection")
            ?? throw new InvalidOperationException("DefaultConnection is not configured.");

        // ── Database ──
        services.AddDbContext<ClariveDbContext>(options =>
        {
            options.UseNpgsql(connectionString);
            options.ConfigureWarnings(w =>
                w.Ignore(RelationalEventId.PendingModelChangesWarning)
                    .Ignore(CoreEventId.FirstWithoutOrderByAndFilterWarning)
                    .Ignore(RelationalEventId.MultipleCollectionIncludeWarning)
            );
        });

        // NpgsqlDataSource (for raw SQL queries against Serilog logs table)
        services.AddSingleton(sp =>
        {
            var config = sp.GetRequiredService<IConfiguration>();
            var connStr = config.GetConnectionString("DefaultConnection")!;
            return NpgsqlDataSource.Create(connStr);
        });

        // ── Caching (FusionCache: L1 memory + L2 Valkey) ──
        services.AddStackExchangeRedisCache(options =>
        {
            options.Configuration = configuration.GetConnectionString("Valkey");
            options.InstanceName = "clarive:";
        });
        services.AddFusionCache()
            .WithDefaultEntryOptions(new FusionCacheEntryOptions
            {
                Duration = TimeSpan.FromMinutes(5),
                IsFailSafeEnabled = true,
                FailSafeMaxDuration = TimeSpan.FromHours(1),
                FailSafeThrottleDuration = TimeSpan.FromSeconds(30),
                EagerRefreshThreshold = 0.9f,
            })
            .WithSerializer(
                new FusionCacheSystemTextJsonSerializer()
            );
        services.AddScoped<ITenantCacheService, TenantCacheService>();

        // ── Unit of Work ──
        services.AddScoped<IUnitOfWork, UnitOfWork>();

        // ── Repositories (Scoped — one DbContext per request) ──
        services.AddScoped<ITenantRepository, EfTenantRepository>();
        services.AddScoped<IUserRepository, EfUserRepository>();
        services.AddScoped<IFolderRepository, EfFolderRepository>();
        services.AddScoped<IEntryRepository, EfEntryRepository>();
        services.AddScoped<IToolRepository, EfToolRepository>();
        services.AddScoped<IMcpServerRepository, EfMcpServerRepository>();
        services.AddScoped<IApiKeyRepository, EfApiKeyRepository>();
        services.AddScoped<IAuditLogRepository, EfAuditLogRepository>();
        services.AddScoped<IAiSessionRepository, EfAiSessionRepository>();
        services.AddScoped<IRefreshTokenRepository, EfRefreshTokenRepository>();
        services.AddScoped<ITokenRepository, EfTokenRepository>();
        services.AddScoped<ILoginSessionRepository, EfLoginSessionRepository>();
        services.AddScoped<IInvitationRepository, EfInvitationRepository>();
        services.AddScoped<ITenantMembershipRepository, EfTenantMembershipRepository>();
        services.AddScoped<ITagRepository, EfTagRepository>();
        services.AddScoped<IFavoriteRepository, EfFavoriteRepository>();
        services.AddScoped<IPlaygroundRunRepository, EfPlaygroundRunRepository>();
        services.AddScoped<IAiProviderRepository, EfAiProviderRepository>();
        services.AddScoped<IServiceConfigRepository, EfServiceConfigRepository>();
        services.AddScoped<IAiUsageLogRepository, EfAiUsageLogRepository>();
        services.AddScoped<IShareLinkRepository, EfShareLinkRepository>();
        services.AddScoped<ISystemConfigRepository, EfSystemConfigRepository>();
        services.AddScoped<IPlatformStatsRepository, EfPlatformStatsRepository>();
        services.AddScoped<ISuperAdminRepository, EfSuperAdminRepository>();
        services.AddScoped<IOnboardingRepository, EfOnboardingRepository>();
        services.AddScoped<IAccountPurgeRepository, EfAccountPurgeRepository>();
        services.AddScoped<IJobExecutionHistoryRepository, EfJobExecutionHistoryRepository>();

        // ── Presence (ephemeral, in-memory) ──
        services.AddSingleton<Clarive.Domain.Interfaces.Services.IPresenceTracker, InMemoryPresenceTracker>();

        // ── Security ──
        services.AddSingleton<PasswordHasher>();
        services.AddSingleton<IEncryptionService, EncryptionService>();

        // ── Email (all providers registered, resolved dynamically per-request) ──
        services.AddHttpClient<ResendClient>();
        services.AddSingleton<IConfigureOptions<ResendClientOptions>>(sp =>
        {
            var config = sp.GetRequiredService<IConfiguration>();
            return new ConfigureOptions<ResendClientOptions>(o =>
                o.ApiToken = config["Email:ApiKey"] ?? ""
            );
        });
        services.AddTransient<IResend, ResendClient>();
        services.AddScoped<ResendEmailService>();
        services.AddScoped<SmtpEmailService>();
        services.AddScoped<ConsoleEmailService>();
        services.AddScoped<IEmailService>(sp =>
        {
            var config = sp.GetRequiredService<IConfiguration>();
            var provider = config["Email:Provider"] ?? "none";
            return provider.ToLowerInvariant() switch
            {
                "resend" => sp.GetRequiredService<ResendEmailService>(),
                "smtp" => sp.GetRequiredService<SmtpEmailService>(),
                _ => sp.GetRequiredService<ConsoleEmailService>(),
            };
        });
        services.Configure<EmailSettings>(configuration.GetSection("Email"));

        // ── Quartz.NET Scheduler (persistent PostgreSQL job store) ──
        services.AddQuartz(q =>
        {
            q.UseDefaultThreadPool(tp => tp.MaxConcurrency = 5);

            q.UsePersistentStore(store =>
            {
                store.UseProperties = true;
                store.UsePostgres(pg =>
                {
                    pg.ConnectionString = connectionString;
                    pg.TablePrefix = "qrtz_";
                });
                store.UseNewtonsoftJsonSerializer();
                store.PerformSchemaValidation = false;
            });

            // ── Infrastructure cleanup jobs ──
            q.AddJob<TokenCleanupJob>(opts => opts
                .WithIdentity("TokenCleanup", "Infrastructure")
                .StoreDurably());
            q.AddTrigger(opts => opts
                .ForJob("TokenCleanup", "Infrastructure")
                .WithIdentity("TokenCleanup-trigger")
                .WithCronSchedule("0 0 */6 * * ?"));

            q.AddJob<AiSessionCleanupJob>(opts => opts
                .WithIdentity("AiSessionCleanup", "Infrastructure")
                .StoreDurably());
            q.AddTrigger(opts => opts
                .ForJob("AiSessionCleanup", "Infrastructure")
                .WithIdentity("AiSessionCleanup-trigger")
                .WithCronSchedule("0 0 * * * ?"));

            q.AddJob<AiUsageCleanupJob>(opts => opts
                .WithIdentity("AiUsageCleanup", "Infrastructure")
                .StoreDurably());
            q.AddTrigger(opts => opts
                .ForJob("AiUsageCleanup", "Infrastructure")
                .WithIdentity("AiUsageCleanup-trigger")
                .WithCronSchedule("0 0 3 * * ?"));

            q.AddJob<LogCleanupJob>(opts => opts
                .WithIdentity("LogCleanup", "Infrastructure")
                .StoreDurably());
            q.AddTrigger(opts => opts
                .ForJob("LogCleanup", "Infrastructure")
                .WithIdentity("LogCleanup-trigger")
                .WithCronSchedule("0 0 4 * * ?"));

            q.AddJob<HistoryCleanupJob>(opts => opts
                .WithIdentity("HistoryCleanup", "Infrastructure")
                .StoreDurably());
            q.AddTrigger(opts => opts
                .ForJob("HistoryCleanup", "Infrastructure")
                .WithIdentity("HistoryCleanup-trigger")
                .WithCronSchedule("0 0 5 * * ?"));

            // ── Job execution history listener (captures all job events) ──
            q.AddJobListener<JobExecutionHistoryListener>(GroupMatcher<JobKey>.AnyGroup());
        });

        // Listener is singleton (Quartz requirement) — uses IServiceScopeFactory internally
        services.AddSingleton<JobExecutionHistoryListener>();

        return services;
    }
}
