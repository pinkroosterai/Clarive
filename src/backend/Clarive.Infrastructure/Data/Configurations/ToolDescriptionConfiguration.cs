using System.Text.Json;
using System.Text.Json.Nodes;
using Clarive.Domain.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace Clarive.Infrastructure.Data.Configurations;

public class ToolDescriptionConfiguration : IEntityTypeConfiguration<ToolDescription>
{
    public void Configure(EntityTypeBuilder<ToolDescription> builder)
    {
        builder.ToTable("tool_descriptions");

        builder.HasKey(t => t.Id);
        builder.Property(t => t.Id).HasColumnName("id");
        builder.Property(t => t.TenantId).HasColumnName("tenant_id").IsRequired();
        builder.Property(t => t.Name).HasColumnName("name").HasMaxLength(100).IsRequired();
        builder.Property(t => t.ToolName).HasColumnName("tool_name").HasMaxLength(100).IsRequired();
        builder.Property(t => t.Description).HasColumnName("description").IsRequired();
        builder
            .Property(t => t.InputSchema)
            .HasColumnName("input_schema")
            .HasColumnType("jsonb")
            .HasConversion(
                v => JsonSerializer.Serialize(v, (JsonSerializerOptions?)null),
                v => JsonSerializer.Deserialize<JsonNode>(v, (JsonSerializerOptions?)null)
            );
        builder.Property(t => t.McpServerId).HasColumnName("mcp_server_id");
        builder.Property(t => t.CreatedAt).HasColumnName("created_at").IsRequired();

        builder
            .HasOne<Tenant>()
            .WithMany()
            .HasForeignKey(t => t.TenantId)
            .OnDelete(DeleteBehavior.Cascade);

        builder
            .HasOne<McpServer>()
            .WithMany()
            .HasForeignKey(t => t.McpServerId)
            .OnDelete(DeleteBehavior.SetNull);

        builder.HasIndex(t => t.TenantId).HasDatabaseName("ix_tool_descriptions_tenant_id");
        builder.HasIndex(t => t.McpServerId).HasDatabaseName("ix_tool_descriptions_mcp_server_id");
    }
}
