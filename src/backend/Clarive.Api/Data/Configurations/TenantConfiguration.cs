using Clarive.Api.Models.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace Clarive.Api.Data.Configurations;

public class TenantConfiguration : IEntityTypeConfiguration<Tenant>
{
    public void Configure(EntityTypeBuilder<Tenant> builder)
    {
        builder.ToTable("tenants");

        builder.HasKey(t => t.Id);
        builder.Property(t => t.Id).HasColumnName("id");
        builder.Property(t => t.Name).HasColumnName("name").HasMaxLength(255).IsRequired();
        builder.Property(t => t.CreatedAt).HasColumnName("created_at").IsRequired();
        builder.Property(t => t.OwnerId).HasColumnName("owner_id");
        builder.Property(t => t.DeletedAt).HasColumnName("deleted_at");
        builder.Property(t => t.DeleteScheduledAt).HasColumnName("delete_scheduled_at");
        builder.Property(t => t.AvatarPath).HasColumnName("avatar_path").HasMaxLength(512);

        builder.HasMany(t => t.Users).WithOne().HasForeignKey(u => u.TenantId);
        builder.HasMany(t => t.Folders).WithOne().HasForeignKey(f => f.TenantId);
        builder.HasMany(t => t.Entries).WithOne().HasForeignKey(e => e.TenantId);

        builder
            .HasOne<User>()
            .WithMany()
            .HasForeignKey(t => t.OwnerId)
            .OnDelete(DeleteBehavior.SetNull);
    }
}
