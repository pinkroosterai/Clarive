using Clarive.Application.Tabs.Contracts;
using Clarive.Application.Tabs.Services;
using Clarive.Domain.Entities;
using Clarive.Domain.Enums;
using Clarive.Domain.Interfaces.Repositories;
using Clarive.Domain.Interfaces.Services;
using FluentAssertions;
using Microsoft.Extensions.Logging;
using NSubstitute;

namespace Clarive.Api.UnitTests.Services;

public class TabServiceTests
{
    private readonly IEntryRepository _entryRepo = Substitute.For<IEntryRepository>();
    private readonly IUnitOfWork _unitOfWork = Substitute.For<IUnitOfWork>();
    private readonly ILogger<TabService> _logger = Substitute.For<ILogger<TabService>>();
    private readonly TabService _sut;

    private static readonly Guid TenantId = Guid.NewGuid();
    private static readonly Guid EntryId = Guid.NewGuid();

    public TabServiceTests()
    {
        _sut = new TabService(_entryRepo, _unitOfWork, _logger);

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

    private PromptEntryVersion MakeTab(string name, bool isMain = false) => new()
    {
        Id = Guid.NewGuid(),
        EntryId = EntryId,
        Version = 0,
        VersionState = VersionState.Tab,
        TabName = name,
        IsMainTab = isMain,
        CreatedAt = DateTime.UtcNow,
    };

    [Fact]
    public async Task CreateAsync_Success_ReturnsTabInfo()
    {
        var entry = MakeEntry();
        var baseVersion = MakePublishedVersion();
        _entryRepo.GetByIdAsync(TenantId, EntryId, Arg.Any<CancellationToken>()).Returns(entry);
        _entryRepo.GetVersionAsync(TenantId, EntryId, 1, Arg.Any<CancellationToken>()).Returns(baseVersion);
        _entryRepo.GetTabByNameAsync(TenantId, EntryId, "test-tab", Arg.Any<CancellationToken>())
            .Returns((PromptEntryVersion?)null);
        _entryRepo.GetTabsAsync(TenantId, EntryId, Arg.Any<CancellationToken>())
            .Returns(new List<PromptEntryVersion>());
        _entryRepo.CreateVersionAsync(Arg.Any<PromptEntryVersion>(), Arg.Any<CancellationToken>())
            .Returns(ci => ci.ArgAt<PromptEntryVersion>(0));

        var result = await _sut.CreateAsync(TenantId, EntryId, new CreateTabRequest("test-tab", 1));

        result.IsError.Should().BeFalse();
        result.Value.Name.Should().Be("test-tab");
        result.Value.ForkedFromVersion.Should().Be(1);
        result.Value.IsMainTab.Should().BeFalse();
    }

    [Fact]
    public async Task CreateAsync_EntryNotFound_ReturnsError()
    {
        _entryRepo.GetByIdAsync(TenantId, EntryId, Arg.Any<CancellationToken>())
            .Returns((PromptEntry?)null);

        var result = await _sut.CreateAsync(TenantId, EntryId, new CreateTabRequest("test", 1));

        result.IsError.Should().BeTrue();
        result.FirstError.Code.Should().Be("ENTRY_NOT_FOUND");
    }

    [Fact]
    public async Task CreateAsync_BaseVersionNotFound_ReturnsError()
    {
        _entryRepo.GetByIdAsync(TenantId, EntryId, Arg.Any<CancellationToken>()).Returns(MakeEntry());
        _entryRepo.GetVersionAsync(TenantId, EntryId, 99, Arg.Any<CancellationToken>())
            .Returns((PromptEntryVersion?)null);

        var result = await _sut.CreateAsync(TenantId, EntryId, new CreateTabRequest("test", 99));

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
        _entryRepo.GetTabByNameAsync(TenantId, EntryId, "duplicate", Arg.Any<CancellationToken>())
            .Returns(MakeTab("duplicate"));

        var result = await _sut.CreateAsync(TenantId, EntryId, new CreateTabRequest("duplicate", 1));

        result.IsError.Should().BeTrue();
        result.FirstError.Code.Should().Be("DUPLICATE_TAB_NAME");
    }

    [Fact]
    public async Task CreateAsync_MaxTabsExceeded_ReturnsError()
    {
        var entry = MakeEntry();
        var baseVersion = MakePublishedVersion();
        _entryRepo.GetByIdAsync(TenantId, EntryId, Arg.Any<CancellationToken>()).Returns(entry);
        _entryRepo.GetVersionAsync(TenantId, EntryId, 1, Arg.Any<CancellationToken>()).Returns(baseVersion);
        _entryRepo.GetTabByNameAsync(TenantId, EntryId, "new-one", Arg.Any<CancellationToken>())
            .Returns((PromptEntryVersion?)null);

        var twentyTabs = Enumerable.Range(0, 20)
            .Select(i => MakeTab($"tab-{i}"))
            .ToList();
        _entryRepo.GetTabsAsync(TenantId, EntryId, Arg.Any<CancellationToken>()).Returns(twentyTabs);

        var result = await _sut.CreateAsync(TenantId, EntryId, new CreateTabRequest("new-one", 1));

        result.IsError.Should().BeTrue();
        result.FirstError.Code.Should().Be("MAX_TABS_EXCEEDED");
    }

    [Fact]
    public async Task ListAsync_ReturnsTabs()
    {
        _entryRepo.GetByIdAsync(TenantId, EntryId, Arg.Any<CancellationToken>()).Returns(MakeEntry());
        _entryRepo.GetTabsAsync(TenantId, EntryId, Arg.Any<CancellationToken>())
            .Returns(new List<PromptEntryVersion>
            {
                MakeTab("Main", isMain: true),
                MakeTab("Experiment"),
            });

        var result = await _sut.ListAsync(TenantId, EntryId);

        result.IsError.Should().BeFalse();
        result.Value.Should().HaveCount(2);
        result.Value[0].Name.Should().Be("Main");
        result.Value[0].IsMainTab.Should().BeTrue();
    }

    [Fact]
    public async Task RenameAsync_Success()
    {
        var tab = MakeTab("old-name");
        _entryRepo.GetVersionByIdAsync(TenantId, tab.Id, Arg.Any<CancellationToken>()).Returns(tab);
        _entryRepo.GetTabByNameAsync(TenantId, EntryId, "new-name", Arg.Any<CancellationToken>())
            .Returns((PromptEntryVersion?)null);
        _entryRepo.UpdateVersionAsync(Arg.Any<PromptEntryVersion>(), Arg.Any<CancellationToken>())
            .Returns(ci => ci.ArgAt<PromptEntryVersion>(0));

        var result = await _sut.RenameAsync(TenantId, EntryId, tab.Id, new RenameTabRequest("new-name"));

        result.IsError.Should().BeFalse();
        result.Value.Name.Should().Be("new-name");
    }

    [Fact]
    public async Task DeleteAsync_Success()
    {
        var tab = MakeTab("to-delete");
        _entryRepo.GetVersionByIdAsync(TenantId, tab.Id, Arg.Any<CancellationToken>()).Returns(tab);

        var result = await _sut.DeleteAsync(TenantId, EntryId, tab.Id);

        result.IsError.Should().BeFalse();
        await _entryRepo.Received(1).DeleteVersionAsync(tab, Arg.Any<CancellationToken>());
    }

    [Fact]
    public async Task DeleteAsync_MainTab_ReturnsError()
    {
        var mainTab = MakeTab("Main", isMain: true);
        _entryRepo.GetVersionByIdAsync(TenantId, mainTab.Id, Arg.Any<CancellationToken>()).Returns(mainTab);

        var result = await _sut.DeleteAsync(TenantId, EntryId, mainTab.Id);

        result.IsError.Should().BeTrue();
        result.FirstError.Code.Should().Be("CANNOT_DELETE_MAIN_TAB");
    }

    [Fact]
    public async Task DeleteAsync_NonTab_ReturnsError()
    {
        var published = new PromptEntryVersion
        {
            Id = Guid.NewGuid(), EntryId = EntryId, VersionState = VersionState.Published,
        };
        _entryRepo.GetVersionByIdAsync(TenantId, published.Id, Arg.Any<CancellationToken>()).Returns(published);

        var result = await _sut.DeleteAsync(TenantId, EntryId, published.Id);

        result.IsError.Should().BeTrue();
        result.FirstError.Code.Should().Be("TAB_NOT_FOUND");
    }
}
