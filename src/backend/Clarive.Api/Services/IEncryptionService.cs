namespace Clarive.Api.Services;

public interface IEncryptionService
{
    bool IsAvailable { get; }
    string Encrypt(string plaintext);
    string Decrypt(string ciphertext);
}
