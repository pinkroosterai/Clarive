using Clarive.Domain.Entities;
using Clarive.Domain.Enums;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace Clarive.Api.Data.Configurations;

public class InvitationConfiguration : IEntityTypeConfiguration<Invitation>
{
    public void Configure(EntityTypeBuilder<Invitation> builder)
    {
        builder.ToTable("invitations");

        builder.HasKey(i => i.Id);
        builder.Property(i => i.Id).HasColumnName("id");
        builder.Property(i => i.TenantId).HasColumnName("tenant_id").IsRequired();
        builder.Property(i => i.Email).HasColumnName("email").HasMaxLength(320).IsRequired();
        builder
            .Property(i => i.Role)
            .HasColumnName("role")
            .HasMaxLength(20)
            .HasConversion<string>()
            .IsRequired();
        builder
            .Property(i => i.TokenHash)
            .HasColumnName("token_hash")
            .HasMaxLength(128)
            .IsRequired();
        builder.Property(i => i.InvitedById).HasColumnName("invited_by_id").IsRequired();
        builder.Property(i => i.TargetUserId).HasColumnName("target_user_id");
        builder.Property(i => i.ExpiresAt).HasColumnName("expires_at").IsRequired();
        builder.Property(i => i.CreatedAt).HasColumnName("created_at").IsRequired();

        builder
            .HasOne<Tenant>()
            .WithMany()
            .HasForeignKey(i => i.TenantId)
            .OnDelete(DeleteBehavior.Cascade);

        builder
            .HasOne<User>()
            .WithMany()
            .HasForeignKey(i => i.InvitedById)
            .OnDelete(DeleteBehavior.Cascade);

        builder
            .HasOne<User>()
            .WithMany()
            .HasForeignKey(i => i.TargetUserId)
            .OnDelete(DeleteBehavior.SetNull);

        builder
            .HasIndex(i => i.TokenHash)
            .IsUnique()
            .HasDatabaseName("uq_invitations_token_hash")
            .HasFilter("\"token_hash\" != ''");
        builder.HasIndex(i => i.TenantId).HasDatabaseName("ix_invitations_tenant_id");
        builder.HasIndex(i => i.TargetUserId).HasDatabaseName("ix_invitations_target_user_id");
    }
}
