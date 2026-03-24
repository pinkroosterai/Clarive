using Clarive.Domain.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace Clarive.Infrastructure.Data.Configurations;

public class PromptConfiguration : IEntityTypeConfiguration<Prompt>
{
    public void Configure(EntityTypeBuilder<Prompt> builder)
    {
        builder.ToTable("prompts");

        builder.HasKey(p => p.Id);
        builder.Property(p => p.Id).HasColumnName("id");
        builder.Property(p => p.VersionId).HasColumnName("version_id").IsRequired();
        builder.Property(p => p.Content).HasColumnName("content").IsRequired();
        builder.Property(p => p.Order).HasColumnName("sort_order").IsRequired();
        builder.Property(p => p.IsTemplate).HasColumnName("is_template").IsRequired();

        builder
            .HasMany(p => p.TemplateFields)
            .WithOne()
            .HasForeignKey(tf => tf.PromptId)
            .OnDelete(DeleteBehavior.Cascade);

        builder.HasIndex(p => p.VersionId).HasDatabaseName("ix_prompts_version");
    }
}
