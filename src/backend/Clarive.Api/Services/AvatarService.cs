using Clarive.Api.Services.Interfaces;
using Microsoft.Extensions.Options;
using SkiaSharp;

namespace Clarive.Api.Services;

public class AvatarSettings
{
    public string StoragePath { get; set; } = Path.Combine("/app", "data", "avatars");
}

public class AvatarService(ILogger<AvatarService> logger, IOptions<AvatarSettings> settings) : IAvatarService
{
    private const int AvatarSize = 256;
    private const int MaxFileBytes = 3 * 1024 * 1024; // 3 MB
    private const int WebPQuality = 85;
    private readonly string StorageRoot = settings.Value.StoragePath;

    private static readonly HashSet<string> AllowedContentTypes =
    [
        "image/jpeg",
        "image/png",
        "image/webp"
    ];

    private static readonly byte[] JpegMagic = [0xFF, 0xD8, 0xFF];
    private static readonly byte[] PngMagic = [0x89, 0x50, 0x4E, 0x47];
    private static readonly byte[] WebPRiff = [0x52, 0x49, 0x46, 0x46]; // "RIFF"
    private static readonly byte[] WebPTag = [0x57, 0x45, 0x42, 0x50]; // "WEBP"

    private static bool HasValidMagicBytes(ReadOnlySpan<byte> data)
    {
        if (data.Length < 12) return false;
        if (data[..3].SequenceEqual(JpegMagic)) return true;
        if (data[..4].SequenceEqual(PngMagic)) return true;
        if (data[..4].SequenceEqual(WebPRiff) && data[8..12].SequenceEqual(WebPTag)) return true;
        return false;
    }

    public async Task<string> SaveAsync(Guid userId, Stream imageStream, string contentType, CancellationToken ct = default)
    {
        if (!AllowedContentTypes.Contains(contentType))
            throw new InvalidOperationException("Unsupported image format. Use JPEG, PNG, or WebP.");

        // Read stream into memory (with size limit)
        using var memoryStream = new MemoryStream();
        await imageStream.CopyToAsync(memoryStream, ct);

        if (memoryStream.Length > MaxFileBytes)
            throw new InvalidOperationException($"Image exceeds the {MaxFileBytes / 1024} KB size limit.");

        if (!HasValidMagicBytes(memoryStream.GetBuffer().AsSpan(0, (int)Math.Min(memoryStream.Length, 12))))
            throw new InvalidOperationException("File content does not match a supported image format.");

        memoryStream.Position = 0;

        // Decode and resize
        using var original = SKBitmap.Decode(memoryStream);
        if (original is null)
            throw new InvalidOperationException("Unable to decode the image.");

        using var resized = original.Resize(new SKSizeI(AvatarSize, AvatarSize), SKSamplingOptions.Default);
        if (resized is null)
            throw new InvalidOperationException("Unable to resize the image.");

        // Encode as WebP
        using var image = SKImage.FromBitmap(resized);
        using var data = image.Encode(SKEncodedImageFormat.Webp, WebPQuality);

        // Save to disk
        Directory.CreateDirectory(StorageRoot);
        var relativePath = $"avatars/{userId}.webp";
        var absolutePath = Path.Combine(StorageRoot, $"{userId}.webp");

        await using var fileStream = new FileStream(absolutePath, FileMode.Create, FileAccess.Write);
        data.SaveTo(fileStream);

        logger.LogInformation("Avatar saved for user {UserId} ({Bytes} bytes)", userId, data.Size);
        return relativePath;
    }

    public Task DeleteAsync(Guid userId, CancellationToken ct = default)
    {
        var absolutePath = Path.Combine(StorageRoot, $"{userId}.webp");

        if (File.Exists(absolutePath))
        {
            File.Delete(absolutePath);
            logger.LogInformation("Avatar deleted for user {UserId}", userId);
        }

        return Task.CompletedTask;
    }

    public async Task<string> SaveTenantAvatarAsync(Guid tenantId, Stream imageStream, string contentType, CancellationToken ct = default)
    {
        if (!AllowedContentTypes.Contains(contentType))
            throw new InvalidOperationException("Unsupported image format. Use JPEG, PNG, or WebP.");

        using var memoryStream = new MemoryStream();
        await imageStream.CopyToAsync(memoryStream, ct);

        if (memoryStream.Length > MaxFileBytes)
            throw new InvalidOperationException($"Image exceeds the {MaxFileBytes / 1024} KB size limit.");

        if (!HasValidMagicBytes(memoryStream.GetBuffer().AsSpan(0, (int)Math.Min(memoryStream.Length, 12))))
            throw new InvalidOperationException("File content does not match a supported image format.");

        memoryStream.Position = 0;

        using var original = SKBitmap.Decode(memoryStream);
        if (original is null)
            throw new InvalidOperationException("Unable to decode the image.");

        using var resized = original.Resize(new SKSizeI(AvatarSize, AvatarSize), SKSamplingOptions.Default);
        if (resized is null)
            throw new InvalidOperationException("Unable to resize the image.");

        using var image = SKImage.FromBitmap(resized);
        using var data = image.Encode(SKEncodedImageFormat.Webp, WebPQuality);

        Directory.CreateDirectory(StorageRoot);
        var fileName = $"tenant_{tenantId}.webp";
        var relativePath = $"avatars/{fileName}";
        var absolutePath = Path.Combine(StorageRoot, fileName);

        await using var fileStream = new FileStream(absolutePath, FileMode.Create, FileAccess.Write);
        data.SaveTo(fileStream);

        logger.LogInformation("Avatar saved for tenant {TenantId} ({Bytes} bytes)", tenantId, data.Size);
        return relativePath;
    }

    public Task DeleteTenantAvatarAsync(Guid tenantId, CancellationToken ct = default)
    {
        var absolutePath = Path.Combine(StorageRoot, $"tenant_{tenantId}.webp");

        if (File.Exists(absolutePath))
        {
            File.Delete(absolutePath);
            logger.LogInformation("Avatar deleted for tenant {TenantId}", tenantId);
        }

        return Task.CompletedTask;
    }

    public string? GetAbsolutePath(string? relativePath)
    {
        if (string.IsNullOrWhiteSpace(relativePath))
            return null;

        // relativePath is "avatars/{userId}.webp", StorageRoot is "/app/data/avatars"
        var fileName = Path.GetFileName(relativePath);
        var absolutePath = Path.Combine(StorageRoot, fileName);
        return File.Exists(absolutePath) ? absolutePath : null;
    }
}
