using Clarive.Api.Models.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace Clarive.Api.Data.Configurations;

public class LoginSessionConfiguration : IEntityTypeConfiguration<LoginSession>
{
    public void Configure(EntityTypeBuilder<LoginSession> builder)
    {
        builder.ToTable("login_sessions");

        builder.HasKey(ls => ls.Id);
        builder.Property(ls => ls.Id).HasColumnName("id");
        builder.Property(ls => ls.UserId).HasColumnName("user_id").IsRequired();
        builder.Property(ls => ls.RefreshTokenId).HasColumnName("refresh_token_id").IsRequired();
        builder
            .Property(ls => ls.IpAddress)
            .HasColumnName("ip_address")
            .HasMaxLength(45)
            .IsRequired();
        builder
            .Property(ls => ls.UserAgent)
            .HasColumnName("user_agent")
            .HasMaxLength(512)
            .IsRequired()
            .HasDefaultValue("");
        builder
            .Property(ls => ls.Browser)
            .HasColumnName("browser")
            .HasMaxLength(100)
            .IsRequired()
            .HasDefaultValue("");
        builder
            .Property(ls => ls.Os)
            .HasColumnName("os")
            .HasMaxLength(100)
            .IsRequired()
            .HasDefaultValue("");
        builder.Property(ls => ls.CreatedAt).HasColumnName("created_at").IsRequired();

        builder
            .HasOne<User>()
            .WithMany()
            .HasForeignKey(ls => ls.UserId)
            .OnDelete(DeleteBehavior.Cascade);

        builder
            .HasOne<RefreshToken>()
            .WithOne()
            .HasForeignKey<LoginSession>(ls => ls.RefreshTokenId)
            .OnDelete(DeleteBehavior.Cascade);

        builder
            .HasIndex(ls => ls.RefreshTokenId)
            .IsUnique()
            .HasDatabaseName("uq_login_sessions_refresh_token");
        builder.HasIndex(ls => ls.UserId).HasDatabaseName("ix_login_sessions_user_id");
        builder.HasIndex(ls => ls.CreatedAt).HasDatabaseName("ix_login_sessions_created_at");
    }
}
