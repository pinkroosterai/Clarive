using Clarive.Domain.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace Clarive.Infrastructure.Data.Configurations;

public class ApiKeyConfiguration : IEntityTypeConfiguration<ApiKey>
{
    public void Configure(EntityTypeBuilder<ApiKey> builder)
    {
        builder.ToTable("api_keys");

        builder.HasKey(k => k.Id);
        builder.Property(k => k.Id).HasColumnName("id");
        builder.Property(k => k.TenantId).HasColumnName("tenant_id").IsRequired();
        builder.Property(k => k.Name).HasColumnName("name").HasMaxLength(100).IsRequired();
        builder.Property(k => k.KeyHash).HasColumnName("key_hash").IsRequired();
        builder
            .Property(k => k.KeyPrefix)
            .HasColumnName("key_prefix")
            .HasMaxLength(50)
            .IsRequired();
        builder.Property(k => k.CreatedAt).HasColumnName("created_at").IsRequired();
        builder.Property(k => k.ExpiresAt).HasColumnName("expires_at");
        builder.Property(k => k.LastUsedAt).HasColumnName("last_used_at");
        builder.Property(k => k.UsageCount).HasColumnName("usage_count").HasDefaultValue(0L);

        builder
            .HasOne<Tenant>()
            .WithMany()
            .HasForeignKey(k => k.TenantId)
            .OnDelete(DeleteBehavior.Cascade);

        builder.HasIndex(k => k.KeyHash).IsUnique().HasDatabaseName("uq_api_keys_key_hash");
        builder.HasIndex(k => k.TenantId).HasDatabaseName("ix_api_keys_tenant_id");
    }
}
