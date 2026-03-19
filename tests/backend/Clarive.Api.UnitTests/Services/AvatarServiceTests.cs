using Clarive.Api.Services;
using FluentAssertions;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;
using NSubstitute;

namespace Clarive.Api.UnitTests.Services;

public class AvatarServiceTests : IDisposable
{
    private readonly string _tempDir;
    private readonly AvatarService _sut;

    public AvatarServiceTests()
    {
        _tempDir = Path.Combine(Path.GetTempPath(), $"clarive-test-{Guid.NewGuid():N}");
        Directory.CreateDirectory(_tempDir);

        var logger = Substitute.For<ILogger<AvatarService>>();
        var settings = Options.Create(new AvatarSettings { StoragePath = _tempDir });
        _sut = new AvatarService(logger, settings);
    }

    public void Dispose()
    {
        if (Directory.Exists(_tempDir))
            Directory.Delete(_tempDir, true);
        GC.SuppressFinalize(this);
    }

    [Theory]
    [InlineData("image/gif")]
    [InlineData("image/svg+xml")]
    [InlineData("application/pdf")]
    [InlineData("text/plain")]
    public async Task SaveAsync_UnsupportedContentType_Throws(string contentType)
    {
        using var stream = new MemoryStream([1, 2, 3]);

        var act = () => _sut.SaveAsync(Guid.NewGuid(), stream, contentType);

        await act.Should()
            .ThrowAsync<InvalidOperationException>()
            .WithMessage("*Unsupported image format*");
    }

    [Fact]
    public async Task SaveAsync_OversizedFile_Throws()
    {
        // 3 MB + 1 byte
        var data = new byte[3 * 1024 * 1024 + 1];
        using var stream = new MemoryStream(data);

        var act = () => _sut.SaveAsync(Guid.NewGuid(), stream, "image/png");

        await act.Should().ThrowAsync<InvalidOperationException>().WithMessage("*size limit*");
    }

    [Theory]
    [InlineData("image/gif")]
    [InlineData("application/octet-stream")]
    public async Task SaveTenantAvatarAsync_UnsupportedContentType_Throws(string contentType)
    {
        using var stream = new MemoryStream([1, 2, 3]);

        var act = () => _sut.SaveTenantAvatarAsync(Guid.NewGuid(), stream, contentType);

        await act.Should()
            .ThrowAsync<InvalidOperationException>()
            .WithMessage("*Unsupported image format*");
    }

    [Fact]
    public async Task SaveTenantAvatarAsync_OversizedFile_Throws()
    {
        var data = new byte[3 * 1024 * 1024 + 1];
        using var stream = new MemoryStream(data);

        var act = () => _sut.SaveTenantAvatarAsync(Guid.NewGuid(), stream, "image/jpeg");

        await act.Should().ThrowAsync<InvalidOperationException>().WithMessage("*size limit*");
    }

    [Fact]
    public async Task DeleteAsync_FileExists_DeletesFile()
    {
        var userId = Guid.NewGuid();
        var filePath = Path.Combine(_tempDir, $"{userId}.webp");
        await File.WriteAllBytesAsync(filePath, [1, 2, 3]);

        await _sut.DeleteAsync(userId);

        File.Exists(filePath).Should().BeFalse();
    }

    [Fact]
    public async Task DeleteAsync_FileNotExists_DoesNotThrow()
    {
        var act = () => _sut.DeleteAsync(Guid.NewGuid());
        await act.Should().NotThrowAsync();
    }

    [Fact]
    public async Task DeleteTenantAvatarAsync_FileExists_DeletesFile()
    {
        var tenantId = Guid.NewGuid();
        var filePath = Path.Combine(_tempDir, $"tenant_{tenantId}.webp");
        await File.WriteAllBytesAsync(filePath, [1, 2, 3]);

        await _sut.DeleteTenantAvatarAsync(tenantId);

        File.Exists(filePath).Should().BeFalse();
    }

    [Fact]
    public async Task DeleteTenantAvatarAsync_FileNotExists_DoesNotThrow()
    {
        var act = () => _sut.DeleteTenantAvatarAsync(Guid.NewGuid());
        await act.Should().NotThrowAsync();
    }

    [Fact]
    public void GetAbsolutePath_NullOrWhitespace_ReturnsNull()
    {
        _sut.GetAbsolutePath(null).Should().BeNull();
        _sut.GetAbsolutePath("").Should().BeNull();
        _sut.GetAbsolutePath("   ").Should().BeNull();
    }

    [Fact]
    public void GetAbsolutePath_FileExists_ReturnsAbsolutePath()
    {
        var fileName = "test-user.webp";
        var filePath = Path.Combine(_tempDir, fileName);
        File.WriteAllBytes(filePath, [1, 2, 3]);

        var result = _sut.GetAbsolutePath($"avatars/{fileName}");

        result.Should().Be(filePath);
    }

    [Fact]
    public void GetAbsolutePath_FileNotExists_ReturnsNull()
    {
        var result = _sut.GetAbsolutePath("avatars/nonexistent.webp");

        result.Should().BeNull();
    }
}
