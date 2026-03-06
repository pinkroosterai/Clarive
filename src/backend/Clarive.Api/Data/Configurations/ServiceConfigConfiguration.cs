using Clarive.Api.Models.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace Clarive.Api.Data.Configurations;

public class ServiceConfigConfiguration : IEntityTypeConfiguration<ServiceConfig>
{
    public void Configure(EntityTypeBuilder<ServiceConfig> builder)
    {
        builder.ToTable("service_config");

        builder.HasKey(c => c.Key);
        builder.Property(c => c.Key).HasColumnName("key").HasMaxLength(128);
        builder.Property(c => c.EncryptedValue).HasColumnName("encrypted_value");
        builder.Property(c => c.IsEncrypted).HasColumnName("is_encrypted")
            .IsRequired().HasDefaultValue(false);
        builder.Property(c => c.UpdatedAt).HasColumnName("updated_at").IsRequired();
        builder.Property(c => c.UpdatedBy).HasColumnName("updated_by").HasMaxLength(255);
    }
}
