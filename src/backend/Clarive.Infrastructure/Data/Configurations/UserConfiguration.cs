using Clarive.Domain.Entities;
using Clarive.Domain.Enums;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace Clarive.Infrastructure.Data.Configurations;

public class UserConfiguration : IEntityTypeConfiguration<User>
{
    public void Configure(EntityTypeBuilder<User> builder)
    {
        builder.ToTable("users");

        builder.HasKey(u => u.Id);
        builder.Property(u => u.Id).HasColumnName("id");
        builder.Property(u => u.TenantId).HasColumnName("tenant_id").IsRequired();
        builder.Property(u => u.Email).HasColumnName("email").HasMaxLength(320).IsRequired();
        builder.Property(u => u.Name).HasColumnName("name").HasMaxLength(255).IsRequired();
        builder.Property(u => u.PasswordHash).HasColumnName("password_hash");
        builder
            .Property(u => u.Role)
            .HasColumnName("role")
            .HasMaxLength(20)
            .HasConversion<string>()
            .IsRequired();
        builder.Property(u => u.CreatedAt).HasColumnName("created_at").IsRequired();
        builder
            .Property(u => u.EmailVerified)
            .HasColumnName("email_verified")
            .IsRequired()
            .HasDefaultValue(false);
        builder.Property(u => u.GoogleId).HasColumnName("google_id").HasMaxLength(255);
        builder.Property(u => u.DeletedAt).HasColumnName("deleted_at");
        builder.Property(u => u.DeleteScheduledAt).HasColumnName("delete_scheduled_at");
        builder
            .Property(u => u.OnboardingCompleted)
            .HasColumnName("onboarding_completed")
            .IsRequired()
            .HasDefaultValue(false);
        builder.Property(u => u.AvatarPath).HasColumnName("avatar_path").HasMaxLength(255);
        builder
            .Property(u => u.IsSuperUser)
            .HasColumnName("is_super_user")
            .IsRequired()
            .HasDefaultValue(false);
        builder.Property(u => u.ThemePreference).HasColumnName("theme_preference").HasMaxLength(10);

        builder.HasIndex(u => u.Email).IsUnique().HasDatabaseName("uq_users_email");
        builder.HasIndex(u => u.TenantId).HasDatabaseName("ix_users_tenant_id");
        builder
            .HasIndex(u => u.GoogleId)
            .IsUnique()
            .HasFilter("google_id IS NOT NULL")
            .HasDatabaseName("uq_users_google_id");
        builder
            .HasIndex(u => u.IsSuperUser)
            .HasFilter("is_super_user = true")
            .HasDatabaseName("ix_users_is_super_user");
    }
}
