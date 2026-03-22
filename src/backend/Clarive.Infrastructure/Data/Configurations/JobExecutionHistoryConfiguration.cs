using Clarive.Domain.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace Clarive.Infrastructure.Data.Configurations;

public class JobExecutionHistoryConfiguration : IEntityTypeConfiguration<JobExecutionHistory>
{
    public void Configure(EntityTypeBuilder<JobExecutionHistory> builder)
    {
        builder.ToTable("job_execution_history");

        builder.HasKey(h => h.Id);
        builder.Property(h => h.Id).HasColumnName("id");
        builder.Property(h => h.JobName).HasColumnName("job_name").HasMaxLength(255).IsRequired();
        builder.Property(h => h.JobGroup).HasColumnName("job_group").HasMaxLength(255).IsRequired();
        builder.Property(h => h.TriggerName).HasColumnName("trigger_name").HasMaxLength(255).IsRequired();
        builder.Property(h => h.FireTimeUtc).HasColumnName("fire_time_utc").IsRequired();
        builder.Property(h => h.StartedAtUtc).HasColumnName("started_at_utc").IsRequired();
        builder.Property(h => h.FinishedAtUtc).HasColumnName("finished_at_utc");
        builder.Property(h => h.DurationMs).HasColumnName("duration_ms");
        builder.Property(h => h.Succeeded).HasColumnName("succeeded").IsRequired();
        builder.Property(h => h.ExceptionMessage).HasColumnName("exception_message");
        builder.Property(h => h.ExceptionStackTrace).HasColumnName("exception_stack_trace");

        builder
            .HasIndex(h => new { h.JobName, h.FireTimeUtc })
            .HasDatabaseName("ix_job_execution_history_job_name_fire_time");

        builder
            .HasIndex(h => h.Succeeded)
            .HasDatabaseName("ix_job_execution_history_succeeded");

        builder
            .HasIndex(h => h.FireTimeUtc)
            .HasDatabaseName("ix_job_execution_history_fire_time");
    }
}
