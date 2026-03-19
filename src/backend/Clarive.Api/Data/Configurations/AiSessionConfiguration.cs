using System.Text.Json;
using Clarive.Api.Models.Agents;
using Clarive.Api.Models.Entities;
using Clarive.Api.Models.Requests;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace Clarive.Api.Data.Configurations;

public class AiSessionConfiguration : IEntityTypeConfiguration<AiSession>
{
    public void Configure(EntityTypeBuilder<AiSession> builder)
    {
        builder.ToTable("ai_sessions");

        builder.HasKey(s => s.Id);
        builder.Property(s => s.Id).HasColumnName("id");
        builder.Property(s => s.TenantId).HasColumnName("tenant_id").IsRequired();
        // WARNING: EF Core's jsonb value converter compares the serialized string
        // to detect changes. In-place mutation of Draft's sub-objects (e.g. modifying
        // a Prompt inside Draft.Prompts) will NOT be detected. Always replace the
        // entire Draft reference when updating: session.Draft = newDraft;
        builder
            .Property(s => s.Draft)
            .HasColumnName("draft")
            .HasColumnType("jsonb")
            .HasConversion(
                v => JsonSerializer.Serialize(v, (JsonSerializerOptions?)null),
                v =>
                    JsonSerializer.Deserialize<CreateEntryRequest>(v, (JsonSerializerOptions?)null)!
            )
            .IsRequired();
        builder
            .Property(s => s.Questions)
            .HasColumnName("questions")
            .HasColumnType("jsonb")
            .HasConversion(
                v => JsonSerializer.Serialize(v, (JsonSerializerOptions?)null),
                v =>
                    JsonSerializer.Deserialize<List<ClarificationQuestion>>(
                        v,
                        (JsonSerializerOptions?)null
                    )!
            )
            .IsRequired();
        builder
            .Property(s => s.Enhancements)
            .HasColumnName("enhancements")
            .HasColumnType("jsonb")
            .HasConversion(
                v => JsonSerializer.Serialize(v, (JsonSerializerOptions?)null),
                v => JsonSerializer.Deserialize<List<string>>(v, (JsonSerializerOptions?)null)!
            )
            .IsRequired();
        builder
            .Property(s => s.ScoreHistory)
            .HasColumnName("score_history")
            .HasColumnType("jsonb")
            .HasConversion(
                v => JsonSerializer.Serialize(v, (JsonSerializerOptions?)null),
                v =>
                    JsonSerializer.Deserialize<List<IterationScore>>(
                        v,
                        (JsonSerializerOptions?)null
                    )!
            )
            .IsRequired();
        builder
            .Property(s => s.Config)
            .HasColumnName("config")
            .HasColumnType("jsonb")
            .HasConversion(
                v => JsonSerializer.Serialize(v, (JsonSerializerOptions?)null),
                v => JsonSerializer.Deserialize<GenerationConfig>(v, (JsonSerializerOptions?)null)
            );
        builder.Property(s => s.AgentSessionId).HasColumnName("agent_session_id").HasMaxLength(64);
        builder.Property(s => s.CreatedAt).HasColumnName("created_at").IsRequired();

        builder
            .HasOne<Tenant>()
            .WithMany()
            .HasForeignKey(s => s.TenantId)
            .OnDelete(DeleteBehavior.Cascade);

        builder.HasIndex(s => s.TenantId).HasDatabaseName("ix_ai_sessions_tenant_id");
    }
}
