using Clarive.Api.Models.Entities;
using Clarive.Api.Models.Enums;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace Clarive.Api.Data.Configurations;

public class PromptEntryVersionConfiguration : IEntityTypeConfiguration<PromptEntryVersion>
{
    public void Configure(EntityTypeBuilder<PromptEntryVersion> builder)
    {
        builder.ToTable("prompt_entry_versions");

        builder.HasKey(v => v.Id);
        builder.Property(v => v.Id).HasColumnName("id");
        builder.Property(v => v.EntryId).HasColumnName("entry_id").IsRequired();
        builder.Property(v => v.Version).HasColumnName("version").IsRequired();
        builder
            .Property(v => v.VersionState)
            .HasColumnName("version_state")
            .HasMaxLength(20)
            .HasConversion<string>()
            .IsRequired();
        builder.Property(v => v.SystemMessage).HasColumnName("system_message");
        builder.Property(v => v.PublishedAt).HasColumnName("published_at");
        builder.Property(v => v.PublishedBy).HasColumnName("published_by");
        builder.Property(v => v.CreatedAt).HasColumnName("created_at").IsRequired();

        builder
            .HasMany(v => v.Prompts)
            .WithOne(p => p.Version)
            .HasForeignKey(p => p.VersionId)
            .OnDelete(DeleteBehavior.Cascade);

        builder
            .Property(v => v.RowVersion)
            .HasColumnName("xmin")
            .HasColumnType("xid")
            .ValueGeneratedOnAddOrUpdate()
            .IsConcurrencyToken();

        builder
            .HasOne<User>()
            .WithMany()
            .HasForeignKey(v => v.PublishedBy)
            .OnDelete(DeleteBehavior.SetNull);

        builder.HasIndex(v => v.EntryId).HasDatabaseName("ix_prompt_entry_versions_entry");
        builder
            .HasIndex(v => new { v.EntryId, v.VersionState })
            .HasDatabaseName("ix_prompt_entry_versions_entry_state");
        builder
            .HasIndex(v => new { v.EntryId, v.Version })
            .IsUnique()
            .HasDatabaseName("uq_prompt_entry_versions_entry_version");
    }
}
