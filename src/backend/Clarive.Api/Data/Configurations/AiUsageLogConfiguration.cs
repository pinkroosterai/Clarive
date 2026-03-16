using Clarive.Api.Models.Entities;
using Clarive.Api.Models.Enums;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace Clarive.Api.Data.Configurations;

public class AiUsageLogConfiguration : IEntityTypeConfiguration<AiUsageLog>
{
    public void Configure(EntityTypeBuilder<AiUsageLog> builder)
    {
        builder.ToTable("ai_usage_logs");

        builder.HasKey(l => l.Id);
        builder.Property(l => l.Id).HasColumnName("id");
        builder.Property(l => l.TenantId).HasColumnName("tenant_id").IsRequired();
        builder.Property(l => l.UserId).HasColumnName("user_id").IsRequired();
        builder.Property(l => l.ActionType).HasColumnName("action_type")
            .HasConversion<string>()
            .HasMaxLength(50)
            .IsRequired();
        builder.Property(l => l.Model).HasColumnName("model").HasMaxLength(100).IsRequired();
        builder.Property(l => l.Provider).HasColumnName("provider").HasMaxLength(100).IsRequired();
        builder.Property(l => l.InputTokens).HasColumnName("input_tokens").IsRequired();
        builder.Property(l => l.OutputTokens).HasColumnName("output_tokens").IsRequired();
        builder.Property(l => l.EstimatedInputCostUsd).HasColumnName("estimated_input_cost_usd")
            .HasPrecision(18, 8);
        builder.Property(l => l.EstimatedOutputCostUsd).HasColumnName("estimated_output_cost_usd")
            .HasPrecision(18, 8);
        builder.Property(l => l.DurationMs).HasColumnName("duration_ms").IsRequired();
        builder.Property(l => l.EntryId).HasColumnName("entry_id");
        builder.Property(l => l.CreatedAt).HasColumnName("created_at").IsRequired();

        builder.HasOne(l => l.Entry)
            .WithMany()
            .HasForeignKey(l => l.EntryId)
            .OnDelete(DeleteBehavior.SetNull);

        builder.HasOne<Tenant>()
            .WithMany()
            .HasForeignKey(l => l.TenantId)
            .OnDelete(DeleteBehavior.Cascade);

        builder.HasIndex(l => new { l.TenantId, l.CreatedAt })
            .HasDatabaseName("ix_ai_usage_logs_tenant_created");
        builder.HasIndex(l => l.Model)
            .HasDatabaseName("ix_ai_usage_logs_model");
        builder.HasIndex(l => l.ActionType)
            .HasDatabaseName("ix_ai_usage_logs_action_type");
    }
}
