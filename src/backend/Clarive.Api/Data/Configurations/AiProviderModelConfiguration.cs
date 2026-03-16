using Clarive.Api.Models.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace Clarive.Api.Data.Configurations;

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
        builder.Property(m => m.MaxContextSize).HasColumnName("max_context_size").IsRequired();

        builder.Property(m => m.DefaultTemperature).HasColumnName("default_temperature");
        builder.Property(m => m.DefaultMaxTokens).HasColumnName("default_max_tokens");
        builder.Property(m => m.DefaultReasoningEffort).HasColumnName("default_reasoning_effort").HasMaxLength(20);
        builder.Property(m => m.IsActive).HasColumnName("is_active").IsRequired();
        builder.Property(m => m.SortOrder).HasColumnName("sort_order").IsRequired();

        builder.HasIndex(m => new { m.ProviderId, m.ModelId })
            .IsUnique()
            .HasDatabaseName("ix_ai_provider_models_provider_model");
    }
}
