using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging;
using System.Security.Cryptography;
using System.Text;

namespace Clarive.Infrastructure.Security;

public class EncryptionService : IEncryptionService
{
    private readonly byte[]? _key;

    public EncryptionService(IConfiguration configuration, ILogger<EncryptionService> logger)
    {
        var keyBase64 = configuration["CONFIG_ENCRYPTION_KEY"];
        if (string.IsNullOrWhiteSpace(keyBase64))
        {
            logger.LogWarning(
                "CONFIG_ENCRYPTION_KEY not set — service config encryption is disabled. "
                    + "Secret values cannot be stored in the dashboard."
            );
            _key = null;
            return;
        }

        byte[] decoded;
        try
        {
            decoded = Convert.FromBase64String(keyBase64);
        }
        catch (FormatException)
        {
            logger.LogWarning(
                "CONFIG_ENCRYPTION_KEY is not valid base64 — encryption disabled. "
                    + "Generate a valid key with: openssl rand -base64 32"
            );
            _key = null;
            return;
        }

        if (decoded.Length != 32)
        {
            logger.LogWarning(
                "CONFIG_ENCRYPTION_KEY must be exactly 32 bytes (256 bits) when decoded. "
                    + "Got {KeyLength} bytes — encryption disabled. Generate a valid key with: openssl rand -base64 32",
                decoded.Length
            );
            _key = null;
            return;
        }

        _key = decoded;
    }

    public bool IsAvailable => _key is not null;

    public string Encrypt(string plaintext)
    {
        if (_key is null)
            throw new InvalidOperationException(
                "Encryption not available — CONFIG_ENCRYPTION_KEY is not set."
            );

        var nonce = new byte[12];
        RandomNumberGenerator.Fill(nonce);

        var plaintextBytes = Encoding.UTF8.GetBytes(plaintext);
        var ciphertext = new byte[plaintextBytes.Length];
        var tag = new byte[16];

        using var aes = new AesGcm(_key, 16);
        aes.Encrypt(nonce, plaintextBytes, ciphertext, tag);

        // Format: nonce (12) + ciphertext (N) + tag (16)
        var result = new byte[12 + ciphertext.Length + 16];
        nonce.CopyTo(result, 0);
        ciphertext.CopyTo(result, 12);
        tag.CopyTo(result, 12 + ciphertext.Length);

        return Convert.ToBase64String(result);
    }

    public string Decrypt(string ciphertextBase64)
    {
        if (_key is null)
            throw new InvalidOperationException(
                "Encryption not available — CONFIG_ENCRYPTION_KEY is not set."
            );

        var data = Convert.FromBase64String(ciphertextBase64);
        if (data.Length < 28) // 12 nonce + 0 ciphertext + 16 tag minimum
            throw new ArgumentException("Invalid encrypted data — too short.");

        var nonce = data[..12];
        var tag = data[^16..];
        var ciphertext = data[12..^16];
        var plaintext = new byte[ciphertext.Length];

        using var aes = new AesGcm(_key, 16);
        aes.Decrypt(nonce, ciphertext, tag, plaintext);

        return Encoding.UTF8.GetString(plaintext);
    }
}
