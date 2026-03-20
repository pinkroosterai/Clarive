using Clarive.Domain.Entities;
using Clarive.Domain.Enums;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace Clarive.Api.Data.Configurations;

public class TemplateFieldConfiguration : IEntityTypeConfiguration<TemplateField>
{
    public void Configure(EntityTypeBuilder<TemplateField> builder)
    {
        builder.ToTable("template_fields");

        builder.HasKey(tf => tf.Id);
        builder.Property(tf => tf.Id).HasColumnName("id");
        builder.Property(tf => tf.PromptId).HasColumnName("prompt_id").IsRequired();
        builder.Property(tf => tf.Name).HasColumnName("name").HasMaxLength(255).IsRequired();
        builder
            .Property(tf => tf.Type)
            .HasColumnName("type")
            .HasMaxLength(20)
            .HasConversion<string>()
            .IsRequired();
        builder.Property(tf => tf.EnumValues).HasColumnName("enum_values");
        builder.Property(tf => tf.DefaultValue).HasColumnName("default_value");
        builder.Property(tf => tf.Min).HasColumnName("min");
        builder.Property(tf => tf.Max).HasColumnName("max");

        builder.HasIndex(tf => tf.PromptId).HasDatabaseName("ix_template_fields_prompt");
    }
}
