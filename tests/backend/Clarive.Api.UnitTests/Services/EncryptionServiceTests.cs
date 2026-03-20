using Clarive.Infrastructure.Security;
using Clarive.Core.Services;
using FluentAssertions;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging;
using NSubstitute;

namespace Clarive.Api.UnitTests.Services;

public class EncryptionServiceTests
{
    private static EncryptionService CreateService(string? keyBase64 = null)
    {
        var config = new ConfigurationBuilder()
            .AddInMemoryCollection(
                keyBase64 != null
                    ? new Dictionary<string, string?> { ["CONFIG_ENCRYPTION_KEY"] = keyBase64 }
                    : []
            )
            .Build();

        var logger = Substitute.For<ILogger<EncryptionService>>();
        return new EncryptionService(config, logger);
    }

    private static string GenerateValidKey() =>
        Convert.ToBase64String(
            new byte[32]
                .Select((_, i) => (byte)i)
                .ToArray()
        );

    [Fact]
    public void IsAvailable_NoKey_ReturnsFalse()
    {
        var svc = CreateService();
        svc.IsAvailable.Should().BeFalse();
    }

    [Fact]
    public void IsAvailable_ValidKey_ReturnsTrue()
    {
        var svc = CreateService(GenerateValidKey());
        svc.IsAvailable.Should().BeTrue();
    }

    [Fact]
    public void IsAvailable_InvalidBase64_ReturnsFalse()
    {
        var svc = CreateService("not-valid-base64!!!");
        svc.IsAvailable.Should().BeFalse();
    }

    [Fact]
    public void IsAvailable_WrongKeyLength_ReturnsFalse()
    {
        var svc = CreateService(Convert.ToBase64String(new byte[16]));
        svc.IsAvailable.Should().BeFalse();
    }

    [Fact]
    public void Encrypt_NoKey_ThrowsInvalidOperation()
    {
        var svc = CreateService();
        var act = () => svc.Encrypt("hello");
        act.Should().Throw<InvalidOperationException>();
    }

    [Fact]
    public void Decrypt_NoKey_ThrowsInvalidOperation()
    {
        var svc = CreateService();
        var act = () => svc.Decrypt("data");
        act.Should().Throw<InvalidOperationException>();
    }

    [Fact]
    public void EncryptDecrypt_RoundTrip_ReturnsOriginal()
    {
        var svc = CreateService(GenerateValidKey());
        var plaintext = "Hello, World! 🌍";

        var encrypted = svc.Encrypt(plaintext);
        var decrypted = svc.Decrypt(encrypted);

        decrypted.Should().Be(plaintext);
    }

    [Fact]
    public void Encrypt_ProducesDifferentCiphertextEachTime()
    {
        var svc = CreateService(GenerateValidKey());
        var a = svc.Encrypt("same text");
        var b = svc.Encrypt("same text");

        a.Should().NotBe(b, "each encryption uses a random nonce");
    }

    [Fact]
    public void Decrypt_TooShortData_ThrowsArgument()
    {
        var svc = CreateService(GenerateValidKey());
        var tooShort = Convert.ToBase64String(new byte[10]);

        var act = () => svc.Decrypt(tooShort);
        act.Should().Throw<ArgumentException>();
    }

    [Fact]
    public void EncryptDecrypt_EmptyString_RoundTrips()
    {
        var svc = CreateService(GenerateValidKey());
        var encrypted = svc.Encrypt("");
        svc.Decrypt(encrypted).Should().Be("");
    }
}
