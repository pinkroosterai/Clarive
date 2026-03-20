using Clarive.Domain.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace Clarive.Infrastructure.Data.Configurations;

public class EntryTagConfiguration : IEntityTypeConfiguration<EntryTag>
{
    public void Configure(EntityTypeBuilder<EntryTag> builder)
    {
        builder.ToTable("entry_tags");

        builder.HasKey(t => t.Id);
        builder.Property(t => t.Id).HasColumnName("id");
        builder.Property(t => t.TenantId).HasColumnName("tenant_id").IsRequired();
        builder.Property(t => t.EntryId).HasColumnName("entry_id").IsRequired();
        builder.Property(t => t.TagName).HasColumnName("tag_name").HasMaxLength(50).IsRequired();
        builder.Property(t => t.CreatedAt).HasColumnName("created_at").IsRequired();

        builder
            .HasOne<Tenant>()
            .WithMany()
            .HasForeignKey(t => t.TenantId)
            .OnDelete(DeleteBehavior.Cascade);

        builder
            .HasOne<PromptEntry>()
            .WithMany()
            .HasForeignKey(t => t.EntryId)
            .OnDelete(DeleteBehavior.Cascade);

        builder
            .HasIndex(t => new
            {
                t.TenantId,
                t.EntryId,
                t.TagName,
            })
            .IsUnique()
            .HasDatabaseName("uq_entry_tags_tenant_entry_tag");

        builder
            .HasIndex(t => new { t.TenantId, t.TagName })
            .HasDatabaseName("ix_entry_tags_tenant_tag");

        builder
            .HasIndex(t => new { t.TenantId, t.EntryId })
            .HasDatabaseName("ix_entry_tags_tenant_entry");
    }
}
