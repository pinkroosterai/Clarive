using Clarive.Domain.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace Clarive.Infrastructure.Data.Configurations;

public class AiProviderModelConfiguration : IEntityTypeConfiguration<AiProviderModel>
{
    public void Configure(EntityTypeBuilder<AiProviderModel> builder)
    {
        builder.ToTable("ai_provider_models");

        builder.HasKey(m => m.Id);
        builder.Property(m => m.Id).HasColumnName("id");
        builder.Property(m => m.ProviderId).HasColumnName("provider_id").IsRequired();
        builder.Property(m => m.ModelId).HasColumnName("model_id").HasMaxLength(100).IsRequired();
        builder.Property(m => m.DisplayName).HasColumnName("display_name").HasMaxLength(100);
        builder.Property(m => m.IsReasoning).HasColumnName("is_reasoning").IsRequired();
        builder
            .Property(m => m.SupportsFunctionCalling)
            .HasColumnName("supports_function_calling")
            .IsRequired();
        builder
            .Property(m => m.SupportsResponseSchema)
            .HasColumnName("supports_response_schema")
            .IsRequired();
        builder.Property(m => m.MaxInputTokens).HasColumnName("max_input_tokens");
        builder.Property(m => m.MaxOutputTokens).HasColumnName("max_output_tokens");

        builder.Property(m => m.DefaultTemperature).HasColumnName("default_temperature");
        builder.Property(m => m.DefaultMaxTokens).HasColumnName("default_max_tokens");
        builder
            .Property(m => m.DefaultReasoningEffort)
            .HasColumnName("default_reasoning_effort")
            .HasMaxLength(20);
        builder
            .Property(m => m.InputCostPerMillion)
            .HasColumnName("input_cost_per_million")
            .HasPrecision(18, 6);
        builder
            .Property(m => m.OutputCostPerMillion)
            .HasColumnName("output_cost_per_million")
            .HasPrecision(18, 6);
        builder
            .Property(m => m.HasManualCostOverride)
            .HasColumnName("has_manual_cost_override")
            .IsRequired();
        builder.Property(m => m.IsActive).HasColumnName("is_active").IsRequired();
        builder.Property(m => m.SortOrder).HasColumnName("sort_order").IsRequired();

        builder
            .HasIndex(m => new { m.ProviderId, m.ModelId })
            .IsUnique()
            .HasDatabaseName("ix_ai_provider_models_provider_model");
    }
}
