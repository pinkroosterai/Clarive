using Clarive.Domain.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace Clarive.Infrastructure.Data.Configurations;

public class PlaygroundRunConfiguration : IEntityTypeConfiguration<PlaygroundRun>
{
    public void Configure(EntityTypeBuilder<PlaygroundRun> builder)
    {
        builder.ToTable("playground_runs");

        builder.HasKey(r => r.Id);
        builder.Property(r => r.Id).HasColumnName("id");
        builder.Property(r => r.TenantId).HasColumnName("tenant_id").IsRequired();
        builder.Property(r => r.EntryId).HasColumnName("entry_id").IsRequired();
        builder.Property(r => r.UserId).HasColumnName("user_id").IsRequired();
        builder.Property(r => r.Model).HasColumnName("model").HasMaxLength(100).IsRequired();
        builder.Property(r => r.Temperature).HasColumnName("temperature").IsRequired();
        builder.Property(r => r.MaxTokens).HasColumnName("max_tokens").IsRequired();
        builder
            .Property(r => r.TemplateFieldValues)
            .HasColumnName("template_field_values")
            .HasColumnType("jsonb");
        builder
            .Property(r => r.Responses)
            .HasColumnName("responses")
            .HasColumnType("jsonb")
            .IsRequired();
        builder.Property(r => r.Reasoning).HasColumnName("reasoning").HasColumnType("jsonb");
        builder
            .Property(r => r.RenderedSystemMessage)
            .HasColumnName("rendered_system_message")
            .HasColumnType("text");
        builder
            .Property(r => r.RenderedPrompts)
            .HasColumnName("rendered_prompts")
            .HasColumnType("jsonb");
        builder.Property(r => r.CreatedAt).HasColumnName("created_at").IsRequired();

        builder
            .HasOne(r => r.Entry)
            .WithMany()
            .HasForeignKey(r => r.EntryId)
            .OnDelete(DeleteBehavior.Cascade);

        builder
            .HasOne<Tenant>()
            .WithMany()
            .HasForeignKey(r => r.TenantId)
            .OnDelete(DeleteBehavior.Cascade);

        builder
            .HasIndex(r => new { r.TenantId, r.EntryId })
            .HasDatabaseName("ix_playground_runs_tenant_entry");
        builder
            .HasIndex(r => new { r.TenantId, r.CreatedAt })
            .HasDatabaseName("ix_playground_runs_tenant_created");
    }
}
