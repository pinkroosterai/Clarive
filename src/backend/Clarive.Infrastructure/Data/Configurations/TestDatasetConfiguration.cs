using Clarive.Domain.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace Clarive.Infrastructure.Data.Configurations;

public class TestDatasetConfiguration : IEntityTypeConfiguration<TestDataset>
{
    public void Configure(EntityTypeBuilder<TestDataset> builder)
    {
        builder.ToTable("test_datasets");

        builder.HasKey(d => d.Id);
        builder.Property(d => d.Id).HasColumnName("id");
        builder.Property(d => d.TenantId).HasColumnName("tenant_id").IsRequired();
        builder.Property(d => d.EntryId).HasColumnName("entry_id").IsRequired();
        builder.Property(d => d.Name).HasColumnName("name").HasMaxLength(100).IsRequired();
        builder.Property(d => d.CreatedAt).HasColumnName("created_at").IsRequired();
        builder.Property(d => d.UpdatedAt).HasColumnName("updated_at").IsRequired();

        builder
            .HasOne(d => d.Entry)
            .WithMany()
            .HasForeignKey(d => d.EntryId)
            .OnDelete(DeleteBehavior.Cascade);

        builder
            .HasOne<Tenant>()
            .WithMany()
            .HasForeignKey(d => d.TenantId)
            .OnDelete(DeleteBehavior.Cascade);

        builder
            .HasMany(d => d.Rows)
            .WithOne(r => r.Dataset)
            .HasForeignKey(r => r.DatasetId)
            .OnDelete(DeleteBehavior.Cascade);

        builder.HasIndex(d => new { d.TenantId, d.EntryId }).HasDatabaseName("ix_test_datasets_tenant_entry");
        builder.HasIndex(d => d.EntryId).HasDatabaseName("ix_test_datasets_entry");
    }
}
