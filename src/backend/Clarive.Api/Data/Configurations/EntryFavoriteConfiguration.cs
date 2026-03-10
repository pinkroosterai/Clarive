using Clarive.Api.Models.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace Clarive.Api.Data.Configurations;

public class EntryFavoriteConfiguration : IEntityTypeConfiguration<EntryFavorite>
{
    public void Configure(EntityTypeBuilder<EntryFavorite> builder)
    {
        builder.ToTable("entry_favorites");

        builder.HasKey(f => f.Id);
        builder.Property(f => f.Id).HasColumnName("id");
        builder.Property(f => f.TenantId).HasColumnName("tenant_id").IsRequired();
        builder.Property(f => f.UserId).HasColumnName("user_id").IsRequired();
        builder.Property(f => f.EntryId).HasColumnName("entry_id").IsRequired();
        builder.Property(f => f.CreatedAt).HasColumnName("created_at").IsRequired();

        builder.HasOne<Tenant>()
            .WithMany()
            .HasForeignKey(f => f.TenantId)
            .OnDelete(DeleteBehavior.Cascade);

        builder.HasOne<User>()
            .WithMany()
            .HasForeignKey(f => f.UserId)
            .OnDelete(DeleteBehavior.Cascade);

        builder.HasOne<PromptEntry>()
            .WithMany()
            .HasForeignKey(f => f.EntryId)
            .OnDelete(DeleteBehavior.Cascade);

        builder.HasIndex(f => new { f.UserId, f.TenantId, f.EntryId })
            .IsUnique()
            .HasDatabaseName("uq_entry_favorites_user_tenant_entry");

        builder.HasIndex(f => new { f.UserId, f.TenantId, f.CreatedAt })
            .HasDatabaseName("ix_entry_favorites_user_tenant_created");
    }
}
