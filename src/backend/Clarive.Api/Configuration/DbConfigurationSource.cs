using Microsoft.Extensions.Configuration;

namespace Clarive.Api.Configuration;

public class DbConfigurationSource : IConfigurationSource
{
    public string ConnectionString { get; set; } = "";
    public string? EncryptionKeyBase64 { get; set; }
    public TimeSpan ReloadInterval { get; set; } = TimeSpan.FromSeconds(30);

    /// <summary>The last built provider instance, for DI registration.</summary>
    internal DbConfigurationProvider? ProviderInstance { get; private set; }

    public IConfigurationProvider Build(IConfigurationBuilder builder)
    {
        ProviderInstance = new DbConfigurationProvider(this);
        return ProviderInstance;
    }
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
        var source = new DbConfigurationSource
        {
            ConnectionString = connectionString,
            EncryptionKeyBase64 = encryptionKeyBase64,
            ReloadInterval = reloadInterval ?? TimeSpan.FromSeconds(30),
        };
        builder.Add(source);
        // Store source so the provider instance can be registered in DI
        builder.Properties["DbConfigSource"] = source;
        return builder;
    }
}
