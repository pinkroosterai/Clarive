using Clarive.Domain.Entities;
using Clarive.Domain.Enums;
using Clarive.Domain.Interfaces.Repositories;
using FluentAssertions;
using NSubstitute;

namespace Clarive.Api.UnitTests.Services;

public class OnboardingSeederTests
{
    private readonly IOnboardingRepository _repo = Substitute.For<IOnboardingRepository>();
    private readonly OnboardingSeeder _sut;

    private static readonly Guid TenantId = Guid.NewGuid();
    private static readonly Guid UserId = Guid.NewGuid();

    // Capture what was passed to the repository
    private Folder? _capturedFolder;
    private List<PromptEntry>? _capturedEntries;
    private List<PromptEntryVersion>? _capturedVersions;

    public OnboardingSeederTests()
    {
        _repo.SeedAsync(
            Arg.Any<Folder>(),
            Arg.Any<List<PromptEntry>>(),
            Arg.Any<List<PromptEntryVersion>>(),
            Arg.Any<CancellationToken>()
        ).Returns(ci =>
        {
            _capturedFolder = ci.Arg<Folder>();
            _capturedEntries = ci.Arg<List<PromptEntry>>();
            _capturedVersions = ci.Arg<List<PromptEntryVersion>>();
            return Task.CompletedTask;
        });

        _sut = new OnboardingSeeder(_repo);
    }

    [Fact]
    public async Task SeedStarterTemplatesAsync_CreatesGettingStartedFolder()
    {
        await _sut.SeedStarterTemplatesAsync(TenantId, UserId, default);

        _capturedFolder.Should().NotBeNull();
        _capturedFolder!.Name.Should().Be("Getting Started");
        _capturedFolder.TenantId.Should().Be(TenantId);
        _capturedFolder.ParentId.Should().BeNull();
    }

    [Fact]
    public async Task SeedStarterTemplatesAsync_CreatesThreeEntries()
    {
        await _sut.SeedStarterTemplatesAsync(TenantId, UserId, default);

        _capturedEntries.Should().HaveCount(3);
        _capturedEntries!.Select(e => e.Title).Should().Contain("Blog Post Writer");
        _capturedEntries.Select(e => e.Title).Should().Contain("Code Review Assistant");
        _capturedEntries.Select(e => e.Title).Should().Contain("Email Composer");
    }

    [Fact]
    public async Task SeedStarterTemplatesAsync_EntriesArePublished()
    {
        await _sut.SeedStarterTemplatesAsync(TenantId, UserId, default);

        _capturedVersions.Should().HaveCount(6); // 3 published + 3 tab versions

        var published = _capturedVersions!.Where(v => v.VersionState == VersionState.Published).ToList();
        published.Should().HaveCount(3);
        published
            .Should()
            .AllSatisfy(v =>
            {
                v.Version.Should().Be(1);
                v.PublishedBy.Should().Be(UserId);
            });

        var tabs = _capturedVersions.Where(v => v.VersionState == VersionState.Tab).ToList();
        tabs.Should().HaveCount(3);
        tabs
            .Should()
            .AllSatisfy(v =>
            {
                v.Version.Should().Be(0);
                v.IsMainTab.Should().BeTrue();
                v.TabName.Should().Be("Main");
            });
    }

    [Fact]
    public async Task SeedStarterTemplatesAsync_AllEntriesHaveSystemMessages()
    {
        await _sut.SeedStarterTemplatesAsync(TenantId, UserId, default);

        _capturedVersions.Should().AllSatisfy(v => v.SystemMessage.Should().NotBeNullOrWhiteSpace());
    }

    [Fact]
    public async Task SeedStarterTemplatesAsync_EmailComposerHasTwoPrompts()
    {
        await _sut.SeedStarterTemplatesAsync(TenantId, UserId, default);

        var emailEntry = _capturedEntries!.First(e => e.Title == "Email Composer");
        var version = _capturedVersions!.First(v => v.EntryId == emailEntry.Id && v.VersionState == VersionState.Published);

        version.Prompts.Should().HaveCount(2);
        version.Prompts.Should().AllSatisfy(p => p.IsTemplate.Should().BeTrue());
    }

    [Fact]
    public async Task SeedStarterTemplatesAsync_EntriesAssignedToFolder()
    {
        await _sut.SeedStarterTemplatesAsync(TenantId, UserId, default);

        _capturedEntries.Should().AllSatisfy(e => e.FolderId.Should().Be(_capturedFolder!.Id));
    }

    [Fact]
    public async Task SeedStarterTemplatesAsync_TemplateFieldsParsed()
    {
        await _sut.SeedStarterTemplatesAsync(TenantId, UserId, default);

        var blogEntry = _capturedEntries!.First(e => e.Title == "Blog Post Writer");
        var version = _capturedVersions!.First(v => v.EntryId == blogEntry.Id && v.VersionState == VersionState.Published);

        var prompt = version.Prompts.First();
        prompt.IsTemplate.Should().BeTrue();
        prompt.TemplateFields.Should().NotBeEmpty();
    }

    [Fact]
    public async Task SeedStarterTemplatesAsync_CallsRepositorySeedOnce()
    {
        await _sut.SeedStarterTemplatesAsync(TenantId, UserId, default);

        await _repo.Received(1).SeedAsync(
            Arg.Any<Folder>(),
            Arg.Any<List<PromptEntry>>(),
            Arg.Any<List<PromptEntryVersion>>(),
            Arg.Any<CancellationToken>()
        );
    }
}
