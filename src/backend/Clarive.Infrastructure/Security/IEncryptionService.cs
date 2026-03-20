namespace Clarive.Infrastructure.Security;

public interface IEncryptionService
{
    bool IsAvailable { get; }
    string Encrypt(string plaintext);
    string Decrypt(string ciphertext);
}
