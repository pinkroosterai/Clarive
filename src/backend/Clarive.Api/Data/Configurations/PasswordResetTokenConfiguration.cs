using Clarive.Domain.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace Clarive.Api.Data.Configurations;

public class PasswordResetTokenConfiguration : IEntityTypeConfiguration<PasswordResetToken>
{
    public void Configure(EntityTypeBuilder<PasswordResetToken> builder)
    {
        builder.ToTable("password_reset_tokens");

        builder.HasKey(pr => pr.Id);
        builder.Property(pr => pr.Id).HasColumnName("id");
        builder.Property(pr => pr.UserId).HasColumnName("user_id").IsRequired();
        builder
            .Property(pr => pr.TokenHash)
            .HasColumnName("token_hash")
            .HasMaxLength(128)
            .IsRequired();
        builder.Property(pr => pr.ExpiresAt).HasColumnName("expires_at").IsRequired();
        builder.Property(pr => pr.UsedAt).HasColumnName("used_at");
        builder.Property(pr => pr.CreatedAt).HasColumnName("created_at").IsRequired();

        builder
            .HasOne<User>()
            .WithMany()
            .HasForeignKey(pr => pr.UserId)
            .OnDelete(DeleteBehavior.Cascade);

        builder
            .HasIndex(pr => pr.TokenHash)
            .IsUnique()
            .HasDatabaseName("uq_password_reset_token_hash");
        builder.HasIndex(pr => pr.UserId).HasDatabaseName("ix_password_reset_user_id");
    }
}
