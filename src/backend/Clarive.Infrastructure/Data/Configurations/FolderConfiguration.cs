using Clarive.Domain.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace Clarive.Infrastructure.Data.Configurations;

public class FolderConfiguration : IEntityTypeConfiguration<Folder>
{
    public void Configure(EntityTypeBuilder<Folder> builder)
    {
        builder.ToTable("folders");

        builder.HasKey(f => f.Id);
        builder.Property(f => f.Id).HasColumnName("id");
        builder.Property(f => f.TenantId).HasColumnName("tenant_id").IsRequired();
        builder.Property(f => f.Name).HasColumnName("name").HasMaxLength(255).IsRequired();
        builder.Property(f => f.ParentId).HasColumnName("parent_id");
        builder.Property(f => f.CreatedAt).HasColumnName("created_at").IsRequired();

        builder
            .HasOne(f => f.Parent)
            .WithMany(f => f.Children)
            .HasForeignKey(f => f.ParentId)
            .OnDelete(DeleteBehavior.Restrict);

        builder.HasIndex(f => f.TenantId).HasDatabaseName("ix_folders_tenant_id");
        builder
            .HasIndex(f => new { f.TenantId, f.ParentId })
            .HasDatabaseName("ix_folders_tenant_parent");
    }
}
