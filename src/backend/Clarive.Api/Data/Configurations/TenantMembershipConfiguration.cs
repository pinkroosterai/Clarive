using Clarive.Api.Models.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace Clarive.Api.Data.Configurations;

public class TenantMembershipConfiguration : IEntityTypeConfiguration<TenantMembership>
{
    public void Configure(EntityTypeBuilder<TenantMembership> builder)
    {
        builder.ToTable("tenant_memberships");

        builder.HasKey(m => m.Id);
        builder.Property(m => m.Id).HasColumnName("id");
        builder.Property(m => m.UserId).HasColumnName("user_id").IsRequired();
        builder.Property(m => m.TenantId).HasColumnName("tenant_id").IsRequired();
        builder.Property(m => m.Role).HasColumnName("role").HasMaxLength(20)
            .HasConversion<string>().IsRequired();
        builder.Property(m => m.IsPersonal).HasColumnName("is_personal")
            .IsRequired().HasDefaultValue(false);
        builder.Property(m => m.JoinedAt).HasColumnName("joined_at").IsRequired();

        builder.HasOne<User>()
            .WithMany()
            .HasForeignKey(m => m.UserId)
            .OnDelete(DeleteBehavior.Cascade);

        builder.HasOne<Tenant>()
            .WithMany()
            .HasForeignKey(m => m.TenantId)
            .OnDelete(DeleteBehavior.Cascade);

        builder.HasIndex(m => new { m.UserId, m.TenantId })
            .IsUnique()
            .HasDatabaseName("uq_tenant_memberships_user_tenant");

        builder.HasIndex(m => m.UserId)
            .HasDatabaseName("ix_tenant_memberships_user_id");

        builder.HasIndex(m => m.TenantId)
            .HasDatabaseName("ix_tenant_memberships_tenant_id");
    }
}
