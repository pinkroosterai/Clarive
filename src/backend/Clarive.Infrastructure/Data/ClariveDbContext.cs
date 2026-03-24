using System.Linq.Expressions;
using Clarive.Domain.Interfaces;

using Clarive.Domain.Entities;
using Microsoft.EntityFrameworkCore;

namespace Clarive.Infrastructure.Data;

public class ClariveDbContext : DbContext
{
    private Guid? TenantId { get; }

    public ClariveDbContext(
        DbContextOptions<ClariveDbContext> options,
        ITenantProvider? tenantProvider = null
    )
        : base(options)
    {
        TenantId = tenantProvider?.TenantId;
    }

    public DbSet<Tenant> Tenants => Set<Tenant>();
    public DbSet<User> Users => Set<User>();
    public DbSet<Folder> Folders => Set<Folder>();
    public DbSet<PromptEntry> PromptEntries => Set<PromptEntry>();
    public DbSet<PromptEntryVersion> PromptEntryVersions => Set<PromptEntryVersion>();
    public DbSet<Prompt> Prompts => Set<Prompt>();
    public DbSet<TemplateField> TemplateFields => Set<TemplateField>();
    public DbSet<ApiKey> ApiKeys => Set<ApiKey>();
    public DbSet<AuditLogEntry> AuditLogEntries => Set<AuditLogEntry>();
    public DbSet<AiSession> AiSessions => Set<AiSession>();
    public DbSet<ToolDescription> ToolDescriptions => Set<ToolDescription>();
    public DbSet<McpServer> McpServers => Set<McpServer>();
    public DbSet<RefreshToken> RefreshTokens => Set<RefreshToken>();
    public DbSet<EmailVerificationToken> EmailVerificationTokens => Set<EmailVerificationToken>();
    public DbSet<PasswordResetToken> PasswordResetTokens => Set<PasswordResetToken>();
    public DbSet<LoginSession> LoginSessions => Set<LoginSession>();
    public DbSet<Invitation> Invitations => Set<Invitation>();
    public DbSet<TenantMembership> TenantMemberships => Set<TenantMembership>();
    public DbSet<SystemConfig> SystemConfigs => Set<SystemConfig>();
    public DbSet<ServiceConfig> ServiceConfigs => Set<ServiceConfig>();
    public DbSet<EntryTag> EntryTags => Set<EntryTag>();
    public DbSet<EntryFavorite> EntryFavorites => Set<EntryFavorite>();
    public DbSet<PlaygroundRun> PlaygroundRuns => Set<PlaygroundRun>();
    public DbSet<AiProvider> AiProviders => Set<AiProvider>();
    public DbSet<AiProviderModel> AiProviderModels => Set<AiProviderModel>();
    public DbSet<AiUsageLog> AiUsageLogs => Set<AiUsageLog>();
    public DbSet<ShareLink> ShareLinks => Set<ShareLink>();
    public DbSet<JobExecutionHistory> JobExecutionHistories => Set<JobExecutionHistory>();
    public DbSet<TestDataset> TestDatasets => Set<TestDataset>();
    public DbSet<TestDatasetRow> TestDatasetRows => Set<TestDatasetRow>();
    public DbSet<ABTestRun> ABTestRuns => Set<ABTestRun>();
    public DbSet<ABTestResult> ABTestResults => Set<ABTestResult>();

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        modelBuilder.ApplyConfigurationsFromAssembly(typeof(ClariveDbContext).Assembly);

        // Global tenant isolation filters
        foreach (var entityType in modelBuilder.Model.GetEntityTypes())
        {
            if (!typeof(ITenantScoped).IsAssignableFrom(entityType.ClrType))
                continue;

            var parameter = Expression.Parameter(entityType.ClrType, "e");
            var tenantIdProp = Expression.Property(parameter, nameof(ITenantScoped.TenantId));
            var contextTenantId = Expression.Property(
                Expression.Constant(this, typeof(ClariveDbContext)),
                nameof(TenantId)
            );

            // TenantId == null || (Guid?)e.TenantId == TenantId
            var filter = Expression.Lambda(
                Expression.OrElse(
                    Expression.Equal(contextTenantId, Expression.Constant(null, typeof(Guid?))),
                    Expression.Equal(
                        Expression.Convert(tenantIdProp, typeof(Guid?)),
                        contextTenantId
                    )
                ),
                parameter
            );

            entityType.SetQueryFilter(filter);
        }
    }
}
