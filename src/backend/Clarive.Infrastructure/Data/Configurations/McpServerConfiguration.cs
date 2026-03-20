using Clarive.Domain.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace Clarive.Infrastructure.Data.Configurations;

public class McpServerConfiguration : IEntityTypeConfiguration<McpServer>
{
    public void Configure(EntityTypeBuilder<McpServer> builder)
    {
        builder.ToTable("mcp_servers");

        builder.HasKey(s => s.Id);
        builder.Property(s => s.Id).HasColumnName("id");
        builder.Property(s => s.TenantId).HasColumnName("tenant_id").IsRequired();
        builder.Property(s => s.Name).HasColumnName("name").HasMaxLength(200).IsRequired();
        builder.Property(s => s.Url).HasColumnName("url").HasMaxLength(2000).IsRequired();
        builder.Property(s => s.BearerTokenEncrypted).HasColumnName("bearer_token_encrypted");
        builder.Property(s => s.IsActive).HasColumnName("is_active").HasDefaultValue(true);
        builder.Property(s => s.LastSyncedAt).HasColumnName("last_synced_at");
        builder.Property(s => s.NextSyncAt).HasColumnName("next_synced_at");
        builder.Property(s => s.LastSyncError).HasColumnName("last_sync_error");
        builder.Property(s => s.ToolCount).HasColumnName("tool_count").HasDefaultValue(0);
        builder.Property(s => s.CreatedAt).HasColumnName("created_at").IsRequired();
        builder.Property(s => s.UpdatedAt).HasColumnName("updated_at").IsRequired();

        builder
            .HasOne<Tenant>()
            .WithMany()
            .HasForeignKey(s => s.TenantId)
            .OnDelete(DeleteBehavior.Cascade);

        builder
            .HasIndex(s => new { s.TenantId, s.Url })
            .IsUnique()
            .HasDatabaseName("uq_mcp_servers_tenant_url");

        builder.HasIndex(s => s.TenantId).HasDatabaseName("ix_mcp_servers_tenant_id");
    }
}
