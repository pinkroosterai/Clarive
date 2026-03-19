using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Design;

namespace Clarive.Api.Data;

/// <summary>
/// Factory used by EF Core CLI tools (dotnet ef migrations) to create a DbContext
/// at design time without booting the full application host.
/// </summary>
public class DesignTimeDbContextFactory : IDesignTimeDbContextFactory<ClariveDbContext>
{
    public ClariveDbContext CreateDbContext(string[] args)
    {
        var connectionString =
            Environment.GetEnvironmentVariable("CONNECTIONSTRINGS__DEFAULTCONNECTION")
            ?? "Host=localhost;Database=clarive;Username=clarive;Password=clarive";

        var optionsBuilder = new DbContextOptionsBuilder<ClariveDbContext>();
        optionsBuilder.UseNpgsql(connectionString);

        return new ClariveDbContext(optionsBuilder.Options);
    }
}
