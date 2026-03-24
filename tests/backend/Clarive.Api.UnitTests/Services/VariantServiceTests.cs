using Clarive.Application.Variants.Contracts;
using Clarive.Application.Variants.Services;
using Clarive.Domain.Entities;
using Clarive.Domain.Enums;
using Clarive.Domain.Interfaces.Repositories;
using Clarive.Domain.Interfaces.Services;
using FluentAssertions;
using Microsoft.Extensions.Logging;
using NSubstitute;

namespace Clarive.Api.UnitTests.Services;

public class VariantServiceTests
{
    private readonly IEntryRepository _entryRepo = Substitute.For<IEntryRepository>();
    private readonly IUnitOfWork _unitOfWork = Substitute.For<IUnitOfWork>();
    private readonly ILogger<VariantService> _logger = Substitute.For<ILogger<VariantService>>();
    private readonly VariantService _sut;

    private static readonly Guid TenantId = Guid.NewGuid();
    private static readonly Guid EntryId = Guid.NewGuid();

    public VariantServiceTests()
    {
        _sut = new VariantService(_entryRepo, _unitOfWork, _logger);

        // Default: ExecuteInTransactionAsync just runs the delegate
        _unitOfWork.ExecuteInTransactionAsync(
            Arg.Any<Func<Task>>(), Arg.Any<CancellationToken>()
        ).Returns(ci =>
        {
            var func = ci.ArgAt<Func<Task>>(0);
            return func();
        });
    }

    private PromptEntry MakeEntry() => new() { Id = EntryId, TenantId = TenantId, Title = "Test" };

    private PromptEntryVersion MakePublishedVersion(int version = 1) => new()
    {
        Id = Guid.NewGuid(),
        EntryId = EntryId,
        Version = version,
        VersionState = VersionState.Published,
        SystemMessage = "System",
        Prompts = [new Prompt { Id = Guid.NewGuid(), Content = "Hello", Order = 0, TemplateFields = [] }],
        CreatedAt = DateTime.UtcNow,
    };

    [Fact]
    public async Task CreateAsync_Success_ReturnsVariantInfo()
    {
        var entry = MakeEntry();
        var baseVersion = MakePublishedVersion();
        _entryRepo.GetByIdAsync(TenantId, EntryId, Arg.Any<CancellationToken>()).Returns(entry);
        _entryRepo.GetVersionAsync(TenantId, EntryId, 1, Arg.Any<CancellationToken>()).Returns(baseVersion);
        _entryRepo.GetVariantByNameAsync(TenantId, EntryId, "test-variant", Arg.Any<CancellationToken>())
            .Returns((PromptEntryVersion?)null);
        _entryRepo.GetVariantsAsync(TenantId, EntryId, Arg.Any<CancellationToken>())
            .Returns(new List<PromptEntryVersion>());
        _entryRepo.CreateVersionAsync(Arg.Any<PromptEntryVersion>(), Arg.Any<CancellationToken>())
            .Returns(ci => ci.ArgAt<PromptEntryVersion>(0));

        var result = await _sut.CreateAsync(TenantId, EntryId, new CreateVariantRequest("test-variant", 1));

        result.IsError.Should().BeFalse();
        result.Value.Name.Should().Be("test-variant");
        result.Value.BasedOnVersion.Should().Be(1);
    }

    [Fact]
    public async Task CreateAsync_EntryNotFound_ReturnsError()
    {
        _entryRepo.GetByIdAsync(TenantId, EntryId, Arg.Any<CancellationToken>())
            .Returns((PromptEntry?)null);

        var result = await _sut.CreateAsync(TenantId, EntryId, new CreateVariantRequest("test", 1));

        result.IsError.Should().BeTrue();
        result.FirstError.Code.Should().Be("ENTRY_NOT_FOUND");
    }

    [Fact]
    public async Task CreateAsync_BaseVersionNotFound_ReturnsError()
    {
        _entryRepo.GetByIdAsync(TenantId, EntryId, Arg.Any<CancellationToken>()).Returns(MakeEntry());
        _entryRepo.GetVersionAsync(TenantId, EntryId, 99, Arg.Any<CancellationToken>())
            .Returns((PromptEntryVersion?)null);

        var result = await _sut.CreateAsync(TenantId, EntryId, new CreateVariantRequest("test", 99));

        result.IsError.Should().BeTrue();
        result.FirstError.Code.Should().Be("VERSION_NOT_FOUND");
    }

    [Fact]
    public async Task CreateAsync_DuplicateName_ReturnsError()
    {
        var entry = MakeEntry();
        var baseVersion = MakePublishedVersion();
        _entryRepo.GetByIdAsync(TenantId, EntryId, Arg.Any<CancellationToken>()).Returns(entry);
        _entryRepo.GetVersionAsync(TenantId, EntryId, 1, Arg.Any<CancellationToken>()).Returns(baseVersion);
        _entryRepo.GetVariantByNameAsync(TenantId, EntryId, "duplicate", Arg.Any<CancellationToken>())
            .Returns(new PromptEntryVersion { Id = Guid.NewGuid(), VariantName = "duplicate" });

        var result = await _sut.CreateAsync(TenantId, EntryId, new CreateVariantRequest("duplicate", 1));

        result.IsError.Should().BeTrue();
        result.FirstError.Code.Should().Be("DUPLICATE_VARIANT_NAME");
    }

    [Fact]
    public async Task CreateAsync_MaxVariantsExceeded_ReturnsError()
    {
        var entry = MakeEntry();
        var baseVersion = MakePublishedVersion();
        _entryRepo.GetByIdAsync(TenantId, EntryId, Arg.Any<CancellationToken>()).Returns(entry);
        _entryRepo.GetVersionAsync(TenantId, EntryId, 1, Arg.Any<CancellationToken>()).Returns(baseVersion);
        _entryRepo.GetVariantByNameAsync(TenantId, EntryId, "new-one", Arg.Any<CancellationToken>())
            .Returns((PromptEntryVersion?)null);

        var twentyVariants = Enumerable.Range(0, 20)
            .Select(i => new PromptEntryVersion { Id = Guid.NewGuid(), VariantName = $"v{i}" })
            .ToList();
        _entryRepo.GetVariantsAsync(TenantId, EntryId, Arg.Any<CancellationToken>()).Returns(twentyVariants);

        var result = await _sut.CreateAsync(TenantId, EntryId, new CreateVariantRequest("new-one", 1));

        result.IsError.Should().BeTrue();
        result.FirstError.Code.Should().Be("MAX_VARIANTS_EXCEEDED");
    }

    [Fact]
    public async Task ListAsync_ReturnsVariants()
    {
        _entryRepo.GetByIdAsync(TenantId, EntryId, Arg.Any<CancellationToken>()).Returns(MakeEntry());
        _entryRepo.GetVariantsAsync(TenantId, EntryId, Arg.Any<CancellationToken>())
            .Returns(new List<PromptEntryVersion>
            {
                new() { Id = Guid.NewGuid(), VariantName = "alpha", BasedOnVersion = 1, CreatedAt = DateTime.UtcNow, VersionState = VersionState.Variant },
                new() { Id = Guid.NewGuid(), VariantName = "beta", BasedOnVersion = 2, CreatedAt = DateTime.UtcNow, VersionState = VersionState.Variant },
            });

        var result = await _sut.ListAsync(TenantId, EntryId);

        result.IsError.Should().BeFalse();
        result.Value.Should().HaveCount(2);
        result.Value[0].Name.Should().Be("alpha");
    }

    [Fact]
    public async Task RenameAsync_Success()
    {
        var variantId = Guid.NewGuid();
        var variant = new PromptEntryVersion
        {
            Id = variantId, EntryId = EntryId, VersionState = VersionState.Variant,
            VariantName = "old-name", BasedOnVersion = 1, CreatedAt = DateTime.UtcNow,
        };
        _entryRepo.GetVersionByIdAsync(TenantId, variantId, Arg.Any<CancellationToken>()).Returns(variant);
        _entryRepo.GetVariantByNameAsync(TenantId, EntryId, "new-name", Arg.Any<CancellationToken>())
            .Returns((PromptEntryVersion?)null);

        var result = await _sut.RenameAsync(TenantId, EntryId, variantId, new RenameVariantRequest("new-name"));

        result.IsError.Should().BeFalse();
        result.Value.Name.Should().Be("new-name");
    }

    [Fact]
    public async Task DeleteAsync_Success()
    {
        var variantId = Guid.NewGuid();
        var variant = new PromptEntryVersion
        {
            Id = variantId, EntryId = EntryId, VersionState = VersionState.Variant,
            VariantName = "to-delete", BasedOnVersion = 1,
        };
        _entryRepo.GetVersionByIdAsync(TenantId, variantId, Arg.Any<CancellationToken>()).Returns(variant);

        var result = await _sut.DeleteAsync(TenantId, EntryId, variantId);

        result.IsError.Should().BeFalse();
        await _entryRepo.Received(1).DeleteVersionAsync(variant, Arg.Any<CancellationToken>());
    }

    [Fact]
    public async Task DeleteAsync_NonVariant_ReturnsError()
    {
        var versionId = Guid.NewGuid();
        var published = new PromptEntryVersion
        {
            Id = versionId, EntryId = EntryId, VersionState = VersionState.Published,
        };
        _entryRepo.GetVersionByIdAsync(TenantId, versionId, Arg.Any<CancellationToken>()).Returns(published);

        var result = await _sut.DeleteAsync(TenantId, EntryId, versionId);

        result.IsError.Should().BeTrue();
        result.FirstError.Code.Should().Be("VARIANT_NOT_FOUND");
    }
}
