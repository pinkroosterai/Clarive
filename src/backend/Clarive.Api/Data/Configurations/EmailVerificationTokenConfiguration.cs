using Clarive.Domain.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace Clarive.Api.Data.Configurations;

public class EmailVerificationTokenConfiguration : IEntityTypeConfiguration<EmailVerificationToken>
{
    public void Configure(EntityTypeBuilder<EmailVerificationToken> builder)
    {
        builder.ToTable("email_verification_tokens");

        builder.HasKey(ev => ev.Id);
        builder.Property(ev => ev.Id).HasColumnName("id");
        builder.Property(ev => ev.UserId).HasColumnName("user_id").IsRequired();
        builder
            .Property(ev => ev.TokenHash)
            .HasColumnName("token_hash")
            .HasMaxLength(128)
            .IsRequired();
        builder.Property(ev => ev.ExpiresAt).HasColumnName("expires_at").IsRequired();
        builder.Property(ev => ev.UsedAt).HasColumnName("used_at");
        builder.Property(ev => ev.CreatedAt).HasColumnName("created_at").IsRequired();

        builder
            .HasOne<User>()
            .WithMany()
            .HasForeignKey(ev => ev.UserId)
            .OnDelete(DeleteBehavior.Cascade);

        builder
            .HasIndex(ev => ev.TokenHash)
            .IsUnique()
            .HasDatabaseName("uq_email_verification_token_hash");
        builder.HasIndex(ev => ev.UserId).HasDatabaseName("ix_email_verification_user_id");
    }
}
