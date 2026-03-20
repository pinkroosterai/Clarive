using Clarive.Domain.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace Clarive.Api.Data.Configurations;

public class SystemConfigConfiguration : IEntityTypeConfiguration<SystemConfig>
{
    public void Configure(EntityTypeBuilder<SystemConfig> builder)
    {
        builder.ToTable("system_config");

        builder.HasKey(c => c.Id);
        builder.Property(c => c.Id).HasColumnName("id");
        builder
            .Property(c => c.MaintenanceEnabled)
            .HasColumnName("maintenance_enabled")
            .IsRequired()
            .HasDefaultValue(false);
        builder.Property(c => c.MaintenanceSince).HasColumnName("maintenance_since");
        builder.Property(c => c.MaintenanceBy).HasColumnName("maintenance_by").HasMaxLength(255);

        // Seed the single row
        builder.HasData(new SystemConfig { Id = 1, MaintenanceEnabled = false });
    }
}
