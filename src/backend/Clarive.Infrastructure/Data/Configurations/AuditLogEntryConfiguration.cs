using Clarive.Domain.Entities;
using Clarive.Domain.Enums;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace Clarive.Infrastructure.Data.Configurations;

public class AuditLogEntryConfiguration : IEntityTypeConfiguration<AuditLogEntry>
{
    public void Configure(EntityTypeBuilder<AuditLogEntry> builder)
    {
        builder.ToTable("audit_log_entries");

        builder.HasKey(a => a.Id);
        builder.Property(a => a.Id).HasColumnName("id");
        builder.Property(a => a.TenantId).HasColumnName("tenant_id").IsRequired();
        builder
            .Property(a => a.Action)
            .HasColumnName("action")
            .HasMaxLength(30)
            .HasConversion<string>()
            .IsRequired();
        builder
            .Property(a => a.EntityType)
            .HasColumnName("entity_type")
            .HasMaxLength(50)
            .IsRequired();
        builder.Property(a => a.EntityId).HasColumnName("entity_id").IsRequired();
        builder
            .Property(a => a.EntityTitle)
            .HasColumnName("entity_title")
            .HasMaxLength(500)
            .IsRequired();
        builder.Property(a => a.UserId).HasColumnName("user_id").IsRequired();
        builder.Property(a => a.UserName).HasColumnName("user_name").HasMaxLength(255).IsRequired();
        builder.Property(a => a.Timestamp).HasColumnName("timestamp").IsRequired();
        builder.Property(a => a.Details).HasColumnName("details");
        builder.Property(a => a.ExpiresAt).HasColumnName("expires_at").IsRequired();

        builder
            .HasOne<Tenant>()
            .WithMany()
            .HasForeignKey(a => a.TenantId)
            .OnDelete(DeleteBehavior.Cascade);

        builder
            .HasIndex(a => new { a.TenantId, a.Timestamp })
            .IsDescending(false, true)
            .HasDatabaseName("ix_audit_log_tenant_timestamp");
        builder.HasIndex(a => a.ExpiresAt).HasDatabaseName("ix_audit_log_expires");

        builder
            .HasIndex(a => new
            {
                a.TenantId,
                a.EntityId,
                a.Timestamp,
            })
            .IsDescending(false, false, true)
            .HasDatabaseName("ix_audit_log_tenant_entity_timestamp");
    }
}
