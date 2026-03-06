using Clarive.Api.Models.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace Clarive.Api.Data.Configurations;

public class FeedbackEntryConfiguration : IEntityTypeConfiguration<FeedbackEntry>
{
    public void Configure(EntityTypeBuilder<FeedbackEntry> builder)
    {
        builder.ToTable("feedback_entries");

        builder.HasKey(f => f.Id);
        builder.Property(f => f.Id).HasColumnName("id");
        builder.Property(f => f.UserId).HasColumnName("user_id").IsRequired();
        builder.Property(f => f.UserName).HasColumnName("user_name").HasMaxLength(255).IsRequired();
        builder.Property(f => f.UserEmail).HasColumnName("user_email").HasMaxLength(255).IsRequired();
        builder.Property(f => f.Category).HasColumnName("category").HasMaxLength(30)
            .HasConversion<string>().IsRequired();
        builder.Property(f => f.Message).HasColumnName("message").HasMaxLength(2000).IsRequired();
        builder.Property(f => f.PageUrl).HasColumnName("page_url").HasMaxLength(500);
        builder.Property(f => f.UserAgent).HasColumnName("user_agent").HasMaxLength(500);
        builder.Property(f => f.CreatedAt).HasColumnName("created_at").IsRequired();

        builder.HasIndex(f => f.CreatedAt)
            .IsDescending()
            .HasDatabaseName("ix_feedback_entries_created_at");
    }
}
