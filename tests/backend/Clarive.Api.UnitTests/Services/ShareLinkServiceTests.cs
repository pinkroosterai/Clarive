using Clarive.Infrastructure.Security;
using Clarive.Core.Helpers;
using Clarive.Domain.Entities;
using Clarive.Domain.Enums;
using Clarive.Domain.Interfaces.Repositories;
using Clarive.Core.Services;
using FluentAssertions;
using NSubstitute;

namespace Clarive.Api.UnitTests.Services;

public class ShareLinkServiceTests
{
    private readonly IShareLinkRepository _shareLinkRepo = Substitute.For<IShareLinkRepository>();
    private readonly IEntryRepository _entryRepo = Substitute.For<IEntryRepository>();
    private readonly PasswordHasher _passwordHasher = new();
    private readonly ShareLinkService _sut;

    private static readonly Guid TenantId = Guid.NewGuid();
    private static readonly Guid EntryId = Guid.NewGuid();
    private static readonly Guid UserId = Guid.NewGuid();

    public ShareLinkServiceTests()
    {
        _sut = new ShareLinkService(_shareLinkRepo, _entryRepo, _passwordHasher);
    }

    private PromptEntry CreateEntry(bool isTrashed = false) =>
        new()
        {
            Id = EntryId,
            TenantId = TenantId,
            Title = "Test Entry",
            IsTrashed = isTrashed,
            CreatedBy = UserId,
            CreatedAt = DateTime.UtcNow,
        };

    private PromptEntryVersion CreateVersion(
        int version = 1,
        VersionState state = VersionState.Published
    ) =>
        new()
        {
            Id = Guid.NewGuid(),
            EntryId = EntryId,
            Version = version,
            VersionState = state,
            Prompts = [new Prompt { Content = "Test prompt", Order = 0 }],
            CreatedAt = DateTime.UtcNow,
            PublishedAt = state == VersionState.Published ? DateTime.UtcNow : null,
        };

    // ── CreateAsync ──

    [Fact]
    public async Task CreateAsync_ValidEntry_ReturnsTokenAndLink()
    {
        _entryRepo
            .GetByIdAsync(TenantId, EntryId, Arg.Any<CancellationToken>())
            .Returns(CreateEntry());
        _entryRepo
            .GetPublishedVersionAsync(TenantId, EntryId, Arg.Any<CancellationToken>())
            .Returns(CreateVersion());
        _shareLinkRepo
            .CreateAsync(Arg.Any<ShareLink>(), Arg.Any<CancellationToken>())
            .Returns(ci => ci.Arg<ShareLink>());

        var result = await _sut.CreateAsync(TenantId, EntryId, UserId);

        result.IsError.Should().BeFalse();
        result.Value.RawToken.Should().StartWith("sl_");
        result.Value.Link.EntryId.Should().Be(EntryId);
        result.Value.Link.IsActive.Should().BeTrue();
    }

    [Fact]
    public async Task CreateAsync_EntryNotFound_ReturnsError()
    {
        _entryRepo
            .GetByIdAsync(TenantId, EntryId, Arg.Any<CancellationToken>())
            .Returns((PromptEntry?)null);

        var result = await _sut.CreateAsync(TenantId, EntryId, UserId);

        result.IsError.Should().BeTrue();
        result.FirstError.Code.Should().Be("ENTRY_NOT_FOUND");
    }

    [Fact]
    public async Task CreateAsync_TrashedEntry_ReturnsError()
    {
        _entryRepo
            .GetByIdAsync(TenantId, EntryId, Arg.Any<CancellationToken>())
            .Returns(CreateEntry(isTrashed: true));

        var result = await _sut.CreateAsync(TenantId, EntryId, UserId);

        result.IsError.Should().BeTrue();
        result.FirstError.Code.Should().Be("ENTRY_TRASHED");
    }

    [Fact]
    public async Task CreateAsync_NoPublishedVersion_ReturnsError()
    {
        _entryRepo
            .GetByIdAsync(TenantId, EntryId, Arg.Any<CancellationToken>())
            .Returns(CreateEntry());
        _entryRepo
            .GetPublishedVersionAsync(TenantId, EntryId, Arg.Any<CancellationToken>())
            .Returns((PromptEntryVersion?)null);

        var result = await _sut.CreateAsync(TenantId, EntryId, UserId);

        result.IsError.Should().BeTrue();
        result.FirstError.Code.Should().Be("NO_PUBLISHED_VERSION");
    }

    [Fact]
    public async Task CreateAsync_DeletesExistingLink()
    {
        _entryRepo
            .GetByIdAsync(TenantId, EntryId, Arg.Any<CancellationToken>())
            .Returns(CreateEntry());
        _entryRepo
            .GetPublishedVersionAsync(TenantId, EntryId, Arg.Any<CancellationToken>())
            .Returns(CreateVersion());
        _shareLinkRepo
            .CreateAsync(Arg.Any<ShareLink>(), Arg.Any<CancellationToken>())
            .Returns(ci => ci.Arg<ShareLink>());

        await _sut.CreateAsync(TenantId, EntryId, UserId);

        await _shareLinkRepo
            .Received(1)
            .DeleteByEntryIdAsync(TenantId, EntryId, Arg.Any<CancellationToken>());
    }

    [Fact]
    public async Task CreateAsync_WithPassword_HashesPassword()
    {
        _entryRepo
            .GetByIdAsync(TenantId, EntryId, Arg.Any<CancellationToken>())
            .Returns(CreateEntry());
        _entryRepo
            .GetPublishedVersionAsync(TenantId, EntryId, Arg.Any<CancellationToken>())
            .Returns(CreateVersion());
        _shareLinkRepo
            .CreateAsync(Arg.Any<ShareLink>(), Arg.Any<CancellationToken>())
            .Returns(ci => ci.Arg<ShareLink>());

        var result = await _sut.CreateAsync(TenantId, EntryId, UserId, password: "secret123");

        result.IsError.Should().BeFalse();
        result.Value.Link.PasswordHash.Should().NotBeNullOrEmpty();
        _passwordHasher.Verify("secret123", result.Value.Link.PasswordHash!).Should().BeTrue();
    }

    [Fact]
    public async Task CreateAsync_WithPinnedVersion_ValidatesVersion()
    {
        _entryRepo
            .GetByIdAsync(TenantId, EntryId, Arg.Any<CancellationToken>())
            .Returns(CreateEntry());
        _entryRepo
            .GetPublishedVersionAsync(TenantId, EntryId, Arg.Any<CancellationToken>())
            .Returns(CreateVersion());
        _entryRepo
            .GetVersionAsync(TenantId, EntryId, 99, Arg.Any<CancellationToken>())
            .Returns((PromptEntryVersion?)null);

        var result = await _sut.CreateAsync(TenantId, EntryId, UserId, pinnedVersion: 99);

        result.IsError.Should().BeTrue();
        result.FirstError.Code.Should().Be("VERSION_NOT_FOUND");
    }

    // ── RevokeAsync ──

    [Fact]
    public async Task RevokeAsync_ExistingLink_ReturnsSuccess()
    {
        _shareLinkRepo
            .DeleteByEntryIdAsync(TenantId, EntryId, Arg.Any<CancellationToken>())
            .Returns(true);

        var result = await _sut.RevokeAsync(TenantId, EntryId);

        result.IsError.Should().BeFalse();
    }

    [Fact]
    public async Task RevokeAsync_NoLink_ReturnsNotFound()
    {
        _shareLinkRepo
            .DeleteByEntryIdAsync(TenantId, EntryId, Arg.Any<CancellationToken>())
            .Returns(false);

        var result = await _sut.RevokeAsync(TenantId, EntryId);

        result.IsError.Should().BeTrue();
        result.FirstError.Code.Should().Be("SHARE_LINK_NOT_FOUND");
    }

    // ── GetPublicEntryByTokenAsync ──

    [Fact]
    public async Task GetPublicEntryByTokenAsync_ValidToken_ReturnsEntry()
    {
        var (rawToken, tokenHash) = GenerateTestToken();
        var link = CreateShareLink(tokenHash);
        _shareLinkRepo.GetByTokenHashAsync(tokenHash, Arg.Any<CancellationToken>()).Returns(link);
        _entryRepo
            .GetPublishedVersionAsync(TenantId, EntryId, Arg.Any<CancellationToken>())
            .Returns(CreateVersion());
        _entryRepo
            .GetByIdAsync(TenantId, EntryId, Arg.Any<CancellationToken>())
            .Returns(CreateEntry());

        var result = await _sut.GetPublicEntryByTokenAsync(rawToken);

        result.IsError.Should().BeFalse();
        result.Value.Title.Should().Be("Test Entry");
        result.Value.PasswordRequired.Should().BeFalse();
    }

    [Fact]
    public async Task GetPublicEntryByTokenAsync_InvalidToken_ReturnsNotFound()
    {
        _shareLinkRepo
            .GetByTokenHashAsync(Arg.Any<string>(), Arg.Any<CancellationToken>())
            .Returns((ShareLink?)null);

        var result = await _sut.GetPublicEntryByTokenAsync("invalid_token");

        result.IsError.Should().BeTrue();
        result.FirstError.Code.Should().Be("SHARE_LINK_NOT_FOUND");
    }

    [Fact]
    public async Task GetPublicEntryByTokenAsync_ExpiredLink_ReturnsGone()
    {
        var (rawToken, tokenHash) = GenerateTestToken();
        var link = CreateShareLink(tokenHash, expiresAt: DateTime.UtcNow.AddHours(-1));
        _shareLinkRepo.GetByTokenHashAsync(tokenHash, Arg.Any<CancellationToken>()).Returns(link);

        var result = await _sut.GetPublicEntryByTokenAsync(rawToken);

        result.IsError.Should().BeTrue();
        result.FirstError.Code.Should().Be("SHARE_LINK_EXPIRED");
        result.FirstError.NumericType.Should().Be(410);
    }

    [Fact]
    public async Task GetPublicEntryByTokenAsync_PasswordProtected_ReturnsPasswordRequired()
    {
        var (rawToken, tokenHash) = GenerateTestToken();
        var link = CreateShareLink(tokenHash, passwordHash: _passwordHasher.Hash("secret"));
        _shareLinkRepo.GetByTokenHashAsync(tokenHash, Arg.Any<CancellationToken>()).Returns(link);

        var result = await _sut.GetPublicEntryByTokenAsync(rawToken);

        result.IsError.Should().BeFalse();
        result.Value.PasswordRequired.Should().BeTrue();
    }

    // ── VerifyPasswordAndGetEntryAsync ──

    [Fact]
    public async Task VerifyPasswordAndGetEntryAsync_CorrectPassword_ReturnsEntry()
    {
        var (rawToken, tokenHash) = GenerateTestToken();
        var link = CreateShareLink(tokenHash, passwordHash: _passwordHasher.Hash("secret"));
        _shareLinkRepo.GetByTokenHashAsync(tokenHash, Arg.Any<CancellationToken>()).Returns(link);
        _entryRepo
            .GetPublishedVersionAsync(TenantId, EntryId, Arg.Any<CancellationToken>())
            .Returns(CreateVersion());
        _entryRepo
            .GetByIdAsync(TenantId, EntryId, Arg.Any<CancellationToken>())
            .Returns(CreateEntry());

        var result = await _sut.VerifyPasswordAndGetEntryAsync(rawToken, "secret");

        result.IsError.Should().BeFalse();
        result.Value.Title.Should().Be("Test Entry");
    }

    [Fact]
    public async Task VerifyPasswordAndGetEntryAsync_WrongPassword_ReturnsUnauthorized()
    {
        var (rawToken, tokenHash) = GenerateTestToken();
        var link = CreateShareLink(tokenHash, passwordHash: _passwordHasher.Hash("secret"));
        _shareLinkRepo.GetByTokenHashAsync(tokenHash, Arg.Any<CancellationToken>()).Returns(link);

        var result = await _sut.VerifyPasswordAndGetEntryAsync(rawToken, "wrong");

        result.IsError.Should().BeTrue();
        result.FirstError.Code.Should().Be("INVALID_PASSWORD");
    }

    // ── Helpers ──

    private static (string RawToken, string TokenHash) GenerateTestToken()
    {
        var rawToken = "sl_test-token-" + Guid.NewGuid().ToString("N");
        var hash = System.Security.Cryptography.SHA256.HashData(
            System.Text.Encoding.UTF8.GetBytes(rawToken)
        );
        return (rawToken, Convert.ToHexStringLower(hash));
    }

    private ShareLink CreateShareLink(
        string tokenHash,
        DateTime? expiresAt = null,
        string? passwordHash = null,
        int? pinnedVersion = null
    ) =>
        new()
        {
            Id = Guid.NewGuid(),
            TenantId = TenantId,
            EntryId = EntryId,
            TokenHash = tokenHash,
            CreatedBy = UserId,
            CreatedAt = DateTime.UtcNow,
            ExpiresAt = expiresAt,
            PasswordHash = passwordHash,
            PinnedVersion = pinnedVersion,
            AccessCount = 0,
            IsActive = true,
        };
}
