using Clarive.Api.Data;
using Clarive.Api.IntegrationTests.Helpers;
using Clarive.Api.Services.Agents;
using Clarive.Api.Services.Interfaces;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Diagnostics;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.DependencyInjection.Extensions;
using Testcontainers.PostgreSql;
using Xunit;

namespace Clarive.Api.IntegrationTests.Fixtures;

public class IntegrationTestFixture : IAsyncLifetime
{
    private readonly PostgreSqlContainer _postgres = new PostgreSqlBuilder()
        .WithImage("postgres:17-alpine")
        .WithDatabase("clarive_test")
        .WithUsername("test")
        .WithPassword("test")
        .Build();

    private ClariveApiFactory _factory = null!;

    public HttpClient CreateClient() => _factory.CreateClient();

    public IServiceProvider Services => _factory.Services;

    public async Task InitializeAsync()
    {
        await _postgres.StartAsync();

        // Apply EF Core migrations before the app boots (SeedData needs the schema)
        var optionsBuilder = new DbContextOptionsBuilder<ClariveDbContext>();
        optionsBuilder.UseNpgsql(_postgres.GetConnectionString());
        optionsBuilder.ConfigureWarnings(w =>
            w.Ignore(RelationalEventId.PendingModelChangesWarning)
        );
        await using (var db = new ClariveDbContext(optionsBuilder.Options))
        {
            await db.Database.MigrateAsync();
        }

        // Set env vars that Program.cs validates BEFORE builder.Build() runs
        var connStr = _postgres.GetConnectionString();
        Environment.SetEnvironmentVariable("CONNECTIONSTRINGS__DEFAULTCONNECTION", connStr);
        Environment.SetEnvironmentVariable(
            "JWT__SECRET",
            "integration-test-secret-key-minimum-32-characters-long-for-hmac-sha256"
        );

        _factory = new ClariveApiFactory(connStr);

        // Trigger the host to start (seed data runs via Program.cs)
        using var _ = _factory.CreateClient();
    }

    public async Task DisposeAsync()
    {
        await _factory.DisposeAsync();
        await _postgres.DisposeAsync();
    }
}

internal class ClariveApiFactory : WebApplicationFactory<Program>
{
    private readonly string _connectionString;

    public ClariveApiFactory(string connectionString)
    {
        _connectionString = connectionString;
    }

    protected override void ConfigureWebHost(IWebHostBuilder builder)
    {
        builder.UseEnvironment("Testing");

        builder.ConfigureServices(services =>
        {
            // Remove the existing DbContext registration
            var descriptor = services.SingleOrDefault(d =>
                d.ServiceType == typeof(DbContextOptions<ClariveDbContext>)
            );
            if (descriptor is not null)
                services.Remove(descriptor);

            // Add DbContext pointing to Testcontainer PostgreSQL
            services.AddDbContext<ClariveDbContext>(options =>
            {
                options.UseNpgsql(_connectionString);
                options.ConfigureWarnings(w =>
                    w.Ignore(RelationalEventId.PendingModelChangesWarning)
                );
            });

            // Replace real AI orchestrator with deterministic mock
            services.RemoveAll<IPromptOrchestrator>();
            services.AddScoped<IPromptOrchestrator, MockPromptOrchestrator>();

            // Replace real MCP import service with deterministic mock
            services.RemoveAll<IMcpImportService>();
            services.AddScoped<IMcpImportService, MockMcpImportService>();

            // Replace email service with test double that captures invitation URLs
            services.RemoveAll<IEmailService>();
            services.AddScoped<IEmailService, TestEmailService>();

            // Replace Tavily client with deterministic mock
            services.RemoveAll<ITavilyClientService>();
            services.AddSingleton<ITavilyClientService, MockTavilyClientService>();
        });

        // Raise rate limit for tests (all requests share loopback IP)
        builder.ConfigureAppConfiguration(
            (_, config) =>
            {
                config.AddInMemoryCollection(
                    new Dictionary<string, string?>
                    {
                        ["RateLimiting:PermitLimit"] = "10000",
                        ["RateLimiting:StrictPermitLimit"] = "10000",
                        ["ConnectionStrings:DefaultConnection"] = _connectionString,
                        ["Jwt:Secret"] =
                            "integration-test-secret-key-minimum-32-characters-long-for-hmac-sha256",
                        ["Avatar:StoragePath"] = Path.Combine(
                            Path.GetTempPath(),
                            "clarive-test-avatars"
                        ),
                        ["CONFIG_ENCRYPTION_KEY"] = "ChR4vnM1Gafgxlak06xIsYYQ8J+oPVmtuhcWQa7PUNQ=", // 32-byte test key
                    }
                );
            }
        );
    }
}
