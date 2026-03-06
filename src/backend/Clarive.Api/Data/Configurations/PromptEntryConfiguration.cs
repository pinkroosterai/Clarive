using Clarive.Api.Models.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace Clarive.Api.Data.Configurations;

public class PromptEntryConfiguration : IEntityTypeConfiguration<PromptEntry>
{
    public void Configure(EntityTypeBuilder<PromptEntry> builder)
    {
        builder.ToTable("prompt_entries");

        builder.HasKey(e => e.Id);
        builder.Property(e => e.Id).HasColumnName("id");
        builder.Property(e => e.TenantId).HasColumnName("tenant_id").IsRequired();
        builder.Property(e => e.Title).HasColumnName("title").HasMaxLength(500).IsRequired();
        builder.Property(e => e.FolderId).HasColumnName("folder_id");
        builder.Property(e => e.IsTrashed).HasColumnName("is_trashed").HasDefaultValue(false).IsRequired();
        builder.Property(e => e.CreatedBy).HasColumnName("created_by").IsRequired();
        builder.Property(e => e.CreatedAt).HasColumnName("created_at").IsRequired();
        builder.Property(e => e.UpdatedAt).HasColumnName("updated_at").IsRequired();

        builder.HasOne(e => e.Folder)
            .WithMany()
            .HasForeignKey(e => e.FolderId)
            .OnDelete(DeleteBehavior.SetNull);

        builder.HasMany(e => e.Versions)
            .WithOne(v => v.Entry)
            .HasForeignKey(v => v.EntryId)
            .OnDelete(DeleteBehavior.Cascade);

        builder.Property(e => e.RowVersion)
            .HasColumnName("xmin")
            .HasColumnType("xid")
            .ValueGeneratedOnAddOrUpdate()
            .IsConcurrencyToken();

        builder.HasOne<User>()
            .WithMany()
            .HasForeignKey(e => e.CreatedBy)
            .OnDelete(DeleteBehavior.Restrict);

        builder.HasIndex(e => e.TenantId).HasDatabaseName("ix_prompt_entries_tenant_id");
        builder.HasIndex(e => new { e.TenantId, e.FolderId, e.UpdatedAt })
            .IsDescending(false, false, true)
            .HasFilter("NOT is_trashed")
            .HasDatabaseName("ix_prompt_entries_tenant_folder");
        builder.HasIndex(e => new { e.TenantId, e.UpdatedAt })
            .IsDescending(false, true)
            .HasFilter("is_trashed")
            .HasDatabaseName("ix_prompt_entries_tenant_trash");
    }
}
