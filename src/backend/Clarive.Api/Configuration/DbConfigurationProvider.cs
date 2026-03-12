using System.Security.Cryptography;
using System.Text;
using Clarive.Api.Services;
using Microsoft.Extensions.Configuration;
using Npgsql;
using Serilog;

namespace Clarive.Api.Configuration;

public class DbConfigurationProvider : ConfigurationProvider, IDisposable
{
    private readonly DbConfigurationSource _source;
    private readonly Timer _reloadTimer;
    private readonly byte[]? _encryptionKey;

    public DbConfigurationProvider(DbConfigurationSource source)
    {
        _source = source;

        if (!string.IsNullOrWhiteSpace(source.EncryptionKeyBase64))
        {
            try
            {
                _encryptionKey = Convert.FromBase64String(source.EncryptionKeyBase64);
                if (_encryptionKey.Length != 32)
                    _encryptionKey = null;
            }
            catch (FormatException)
            {
                _encryptionKey = null;
            }
        }

        _reloadTimer = new Timer(_ =>
        {
            try { LoadFromDb(); }
            catch (Exception ex) { Log.Warning(ex, "Failed to reload config from database"); }
        }, null, Timeout.Infinite, Timeout.Infinite);
    }

    public override void Load()
    {
        try
        {
            LoadFromDb();
        }
        catch (Exception ex)
        {
            // env vars remain as fallback — expected on first startup before migration runs.
            Log.Warning(ex, "Failed to load config from database on startup");
        }

        // Start periodic reload after initial load attempt
        _reloadTimer.Change(_source.ReloadInterval, _source.ReloadInterval);
    }

    private void LoadFromDb()
    {
        var data = new Dictionary<string, string?>(StringComparer.OrdinalIgnoreCase);

        using var conn = new NpgsqlConnection(_source.ConnectionString);
        conn.Open();

        // Check if table exists (handles first startup before migration)
        using var checkCmd = new NpgsqlCommand(
            "SELECT EXISTS(SELECT 1 FROM information_schema.tables WHERE table_name = 'service_config')", conn);
        var exists = (bool)checkCmd.ExecuteScalar()!;
        if (!exists) return;

        using var cmd = new NpgsqlCommand(
            "SELECT key, encrypted_value, is_encrypted FROM service_config", conn);
        using var reader = cmd.ExecuteReader();

        while (reader.Read())
        {
            var key = reader.GetString(0);
            var encryptedValue = reader.IsDBNull(1) ? null : reader.GetString(1);
            var isEncrypted = reader.GetBoolean(2);

            if (encryptedValue is null) continue;

            // Only process keys in the registry whitelist
            if (!ConfigRegistry.ByKey.ContainsKey(key)) continue;

            string value;
            if (isEncrypted && _encryptionKey is not null)
            {
                try
                {
                    value = DecryptValue(encryptedValue);
                }
                catch (Exception ex)
                {
                    Log.Warning(ex, "Failed to decrypt config key {Key}", key);
                    continue;
                }
            }
            else
            {
                value = encryptedValue;
            }

            data[key] = value;
        }

        // Only update and notify if data actually changed
        var changed = Data.Count != data.Count ||
                      data.Any(kvp => !Data.TryGetValue(kvp.Key, out var existing) || existing != kvp.Value);

        if (changed)
        {
            Data = data;
            OnReload();
        }
    }

    private string DecryptValue(string ciphertextBase64)
    {
        var raw = Convert.FromBase64String(ciphertextBase64);
        var nonce = raw[..12];
        var tag = raw[^16..];
        var ciphertext = raw[12..^16];
        var plaintext = new byte[ciphertext.Length];

        using var aes = new AesGcm(_encryptionKey!, 16);
        aes.Decrypt(nonce, ciphertext, tag, plaintext);

        return Encoding.UTF8.GetString(plaintext);
    }

    public void Dispose() => _reloadTimer.Dispose();
}
