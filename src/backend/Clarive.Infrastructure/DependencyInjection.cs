using Clarive.Domain.Interfaces.Repositories;
using Clarive.Domain.Interfaces.Services;
using Clarive.Infrastructure.BackgroundJobs;
using Clarive.Infrastructure.Cache;
using Clarive.Infrastructure.Data;
using Clarive.Infrastructure.Email;
using Clarive.Infrastructure.Repositories;
using Clarive.Infrastructure.Security;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Diagnostics;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Options;
using Npgsql;
using Resend;

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

        // ── Caching ──
        services.AddStackExchangeRedisCache(options =>
        {
            options.Configuration = configuration.GetConnectionString("Valkey");
            options.InstanceName = "clarive:";
        });
        services.AddScoped<TenantCacheService>();

        // ── Repositories (Scoped — one DbContext per request) ──
        services.AddScoped<ITenantRepository, EfTenantRepository>();
        services.AddScoped<IUserRepository, EfUserRepository>();
        services.AddScoped<IFolderRepository, EfFolderRepository>();
        services.AddScoped<IEntryRepository, EfEntryRepository>();
        services.AddScoped<IToolRepository, EfToolRepository>();
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

        // ── Background Services ──
        services.AddHostedService<TokenCleanupBackgroundService>();
        services.AddHostedService<AiSessionCleanupService>();
        services.AddHostedService<AiUsageCleanupService>();
        services.AddHostedService<LogCleanupService>();

        return services;
    }
}
