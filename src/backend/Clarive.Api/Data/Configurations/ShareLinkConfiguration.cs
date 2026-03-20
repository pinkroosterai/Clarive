using Clarive.Domain.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace Clarive.Api.Data.Configurations;

public class ShareLinkConfiguration : IEntityTypeConfiguration<ShareLink>
{
    public void Configure(EntityTypeBuilder<ShareLink> builder)
    {
        builder.ToTable("share_links");

        builder.HasKey(s => s.Id);
        builder.Property(s => s.Id).HasColumnName("id");
        builder.Property(s => s.TenantId).HasColumnName("tenant_id").IsRequired();
        builder.Property(s => s.EntryId).HasColumnName("entry_id").IsRequired();
        builder.Property(s => s.TokenHash).HasColumnName("token_hash").IsRequired();
        builder.Property(s => s.Token).HasColumnName("token").IsRequired();
        builder.Property(s => s.CreatedBy).HasColumnName("created_by").IsRequired();
        builder.Property(s => s.CreatedAt).HasColumnName("created_at").IsRequired();
        builder.Property(s => s.ExpiresAt).HasColumnName("expires_at");
        builder.Property(s => s.PasswordHash).HasColumnName("password_hash");
        builder.Property(s => s.PinnedVersion).HasColumnName("pinned_version");
        builder.Property(s => s.AccessCount).HasColumnName("access_count").IsRequired();
        builder.Property(s => s.IsActive).HasColumnName("is_active").IsRequired();

        builder
            .HasOne<PromptEntry>()
            .WithMany()
            .HasForeignKey(s => s.EntryId)
            .OnDelete(DeleteBehavior.Cascade);

        builder
            .HasOne<Tenant>()
            .WithMany()
            .HasForeignKey(s => s.TenantId)
            .OnDelete(DeleteBehavior.Cascade);

        builder.HasIndex(s => s.TokenHash).IsUnique().HasDatabaseName("uq_share_links_token_hash");
        builder
            .HasIndex(s => new { s.TenantId, s.EntryId })
            .HasDatabaseName("ix_share_links_tenant_entry");
    }
}
