using System.Text.Json;
using Clarive.Domain.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace Clarive.Infrastructure.Data.Configurations;

public class TestDatasetRowConfiguration : IEntityTypeConfiguration<TestDatasetRow>
{
    public void Configure(EntityTypeBuilder<TestDatasetRow> builder)
    {
        builder.ToTable("test_dataset_rows");

        builder.HasKey(r => r.Id);
        builder.Property(r => r.Id).HasColumnName("id");
        builder.Property(r => r.DatasetId).HasColumnName("dataset_id").IsRequired();
        builder.Property(r => r.CreatedAt).HasColumnName("created_at").IsRequired();

        builder
            .Property(r => r.Values)
            .HasColumnName("values")
            .HasColumnType("jsonb")
            .IsRequired()
            .HasConversion(
                v => JsonSerializer.Serialize(v, (JsonSerializerOptions?)null),
                v => JsonSerializer.Deserialize<Dictionary<string, string>>(v, (JsonSerializerOptions?)null)
                    ?? new Dictionary<string, string>()
            );

        builder.HasIndex(r => r.DatasetId).HasDatabaseName("ix_test_dataset_rows_dataset");
    }
}
