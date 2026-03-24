using System.Text.Json;
using Clarive.Domain.Entities;
using Clarive.Domain.ValueObjects;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace Clarive.Infrastructure.Data.Configurations;

public class ABTestResultConfiguration : IEntityTypeConfiguration<ABTestResult>
{
    public void Configure(EntityTypeBuilder<ABTestResult> builder)
    {
        builder.ToTable("ab_test_results");

        builder.HasKey(r => r.Id);
        builder.Property(r => r.Id).HasColumnName("id");
        builder.Property(r => r.RunId).HasColumnName("run_id").IsRequired();
        builder.Property(r => r.DatasetRowId).HasColumnName("dataset_row_id").IsRequired();
        builder.Property(r => r.VersionAOutput).HasColumnName("version_a_output");
        builder.Property(r => r.VersionBOutput).HasColumnName("version_b_output");

        builder
            .Property(r => r.VersionAScores)
            .HasColumnName("version_a_scores")
            .HasColumnType("jsonb")
            .HasConversion(
                v => v == null ? null : JsonSerializer.Serialize(v, (JsonSerializerOptions?)null),
                v => v == null ? null : JsonSerializer.Deserialize<Dictionary<string, OutputEvaluationEntry>>(v, (JsonSerializerOptions?)null)
            );

        builder
            .Property(r => r.VersionBScores)
            .HasColumnName("version_b_scores")
            .HasColumnType("jsonb")
            .HasConversion(
                v => v == null ? null : JsonSerializer.Serialize(v, (JsonSerializerOptions?)null),
                v => v == null ? null : JsonSerializer.Deserialize<Dictionary<string, OutputEvaluationEntry>>(v, (JsonSerializerOptions?)null)
            );

        builder.Property(r => r.VersionAAvgScore).HasColumnName("version_a_avg_score");
        builder.Property(r => r.VersionBAvgScore).HasColumnName("version_b_avg_score");

        builder.HasIndex(r => r.RunId).HasDatabaseName("ix_ab_test_results_run");
    }
}
