using Clarive.Domain.Entities;
using Clarive.Domain.Enums;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace Clarive.Infrastructure.Data.Configurations;

public class ABTestRunConfiguration : IEntityTypeConfiguration<ABTestRun>
{
    public void Configure(EntityTypeBuilder<ABTestRun> builder)
    {
        builder.ToTable("ab_test_runs");

        builder.HasKey(r => r.Id);
        builder.Property(r => r.Id).HasColumnName("id");
        builder.Property(r => r.TenantId).HasColumnName("tenant_id").IsRequired();
        builder.Property(r => r.EntryId).HasColumnName("entry_id").IsRequired();
        builder.Property(r => r.UserId).HasColumnName("user_id");
        builder.Property(r => r.VersionANumber).HasColumnName("version_a_number").IsRequired();
        builder.Property(r => r.VersionBNumber).HasColumnName("version_b_number").IsRequired();
        builder.Property(r => r.DatasetId).HasColumnName("dataset_id");
        builder.Property(r => r.Model).HasColumnName("model").HasMaxLength(100).IsRequired();
        builder.Property(r => r.Temperature).HasColumnName("temperature").IsRequired();
        builder.Property(r => r.MaxTokens).HasColumnName("max_tokens").IsRequired();
        builder
            .Property(r => r.Status)
            .HasColumnName("status")
            .HasMaxLength(20)
            .HasConversion<string>()
            .IsRequired();
        builder.Property(r => r.CreatedAt).HasColumnName("created_at").IsRequired();
        builder.Property(r => r.CompletedAt).HasColumnName("completed_at");

        builder
            .HasOne(r => r.Entry)
            .WithMany()
            .HasForeignKey(r => r.EntryId)
            .OnDelete(DeleteBehavior.Cascade);

        builder
            .HasOne(r => r.Dataset)
            .WithMany()
            .HasForeignKey(r => r.DatasetId)
            .OnDelete(DeleteBehavior.SetNull);

        builder
            .HasOne<Tenant>()
            .WithMany()
            .HasForeignKey(r => r.TenantId)
            .OnDelete(DeleteBehavior.Cascade);

        builder
            .HasOne<User>()
            .WithMany()
            .HasForeignKey(r => r.UserId)
            .OnDelete(DeleteBehavior.SetNull);

        builder
            .HasMany(r => r.Results)
            .WithOne(res => res.Run)
            .HasForeignKey(res => res.RunId)
            .OnDelete(DeleteBehavior.Cascade);

        builder.HasIndex(r => new { r.TenantId, r.EntryId }).HasDatabaseName("ix_ab_test_runs_tenant_entry");
        builder.HasIndex(r => r.EntryId).HasDatabaseName("ix_ab_test_runs_entry");
    }
}
