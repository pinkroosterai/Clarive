using Microsoft.Extensions.Configuration;

namespace Clarive.Api.Configuration;

public class DbConfigurationSource : IConfigurationSource
{
    public string ConnectionString { get; set; } = "";
    public string? EncryptionKeyBase64 { get; set; }
    public TimeSpan ReloadInterval { get; set; } = TimeSpan.FromSeconds(30);

    public IConfigurationProvider Build(IConfigurationBuilder builder) =>
        new DbConfigurationProvider(this);
}

public static class ConfigurationBuilderExtensions
{
    public static IConfigurationBuilder AddDatabaseConfiguration(
        this IConfigurationBuilder builder,
        string connectionString,
        string? encryptionKeyBase64 = null,
        TimeSpan? reloadInterval = null
    )
    {
        return builder.Add(
            new DbConfigurationSource
            {
                ConnectionString = connectionString,
                EncryptionKeyBase64 = encryptionKeyBase64,
                ReloadInterval = reloadInterval ?? TimeSpan.FromSeconds(30),
            }
        );
    }
}
