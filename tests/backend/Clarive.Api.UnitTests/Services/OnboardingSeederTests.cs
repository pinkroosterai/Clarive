using Clarive.Api.Data;
using Clarive.Api.Models.Enums;
using Clarive.Api.Services;
using FluentAssertions;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Diagnostics;

namespace Clarive.Api.UnitTests.Services;

public class OnboardingSeederTests : IDisposable
{
    private readonly ClariveDbContext _db;
    private readonly OnboardingSeeder _sut;

    private static readonly Guid TenantId = Guid.NewGuid();
    private static readonly Guid UserId = Guid.NewGuid();

    public OnboardingSeederTests()
    {
        var options = new DbContextOptionsBuilder<ClariveDbContext>()
            .UseInMemoryDatabase(Guid.NewGuid().ToString())
            .ConfigureWarnings(w => w.Ignore(InMemoryEventId.TransactionIgnoredWarning))
            .Options;
        _db = new ClariveDbContext(options);
        _sut = new OnboardingSeeder(_db);
    }

    public void Dispose()
    {
        _db.Dispose();
        GC.SuppressFinalize(this);
    }

    [Fact]
    public async Task SeedStarterTemplatesAsync_CreatesGettingStartedFolder()
    {
        await _sut.SeedStarterTemplatesAsync(TenantId, UserId, default);

        var folders = await _db.Folders.ToListAsync();
        folders.Should().ContainSingle();
        folders[0].Name.Should().Be("Getting Started");
        folders[0].TenantId.Should().Be(TenantId);
        folders[0].ParentId.Should().BeNull();
    }

    [Fact]
    public async Task SeedStarterTemplatesAsync_CreatesThreeEntries()
    {
        await _sut.SeedStarterTemplatesAsync(TenantId, UserId, default);

        var entries = await _db.PromptEntries.ToListAsync();
        entries.Should().HaveCount(3);
        entries.Select(e => e.Title).Should().Contain("Blog Post Writer");
        entries.Select(e => e.Title).Should().Contain("Code Review Assistant");
        entries.Select(e => e.Title).Should().Contain("Email Composer");
    }

    [Fact]
    public async Task SeedStarterTemplatesAsync_EntriesArePublished()
    {
        await _sut.SeedStarterTemplatesAsync(TenantId, UserId, default);

        var versions = await _db.PromptEntryVersions.ToListAsync();
        versions.Should().HaveCount(3);
        versions
            .Should()
            .AllSatisfy(v =>
            {
                v.VersionState.Should().Be(VersionState.Published);
                v.Version.Should().Be(1);
                v.PublishedBy.Should().Be(UserId);
            });
    }

    [Fact]
    public async Task SeedStarterTemplatesAsync_AllEntriesHaveSystemMessages()
    {
        await _sut.SeedStarterTemplatesAsync(TenantId, UserId, default);

        var versions = await _db.PromptEntryVersions.ToListAsync();
        versions.Should().AllSatisfy(v => v.SystemMessage.Should().NotBeNullOrWhiteSpace());
    }

    [Fact]
    public async Task SeedStarterTemplatesAsync_EmailComposerHasTwoPrompts()
    {
        await _sut.SeedStarterTemplatesAsync(TenantId, UserId, default);

        var emailEntry = await _db.PromptEntries.FirstAsync(e => e.Title == "Email Composer");
        var version = await _db
            .PromptEntryVersions.Include(v => v.Prompts)
            .FirstAsync(v => v.EntryId == emailEntry.Id);

        version.Prompts.Should().HaveCount(2);
        version.Prompts.Should().AllSatisfy(p => p.IsTemplate.Should().BeTrue());
    }

    [Fact]
    public async Task SeedStarterTemplatesAsync_EntriesAssignedToFolder()
    {
        await _sut.SeedStarterTemplatesAsync(TenantId, UserId, default);

        var folder = await _db.Folders.FirstAsync();
        var entries = await _db.PromptEntries.ToListAsync();
        entries.Should().AllSatisfy(e => e.FolderId.Should().Be(folder.Id));
    }

    [Fact]
    public async Task SeedStarterTemplatesAsync_TemplateFieldsParsed()
    {
        await _sut.SeedStarterTemplatesAsync(TenantId, UserId, default);

        var blogEntry = await _db.PromptEntries.FirstAsync(e => e.Title == "Blog Post Writer");
        var version = await _db
            .PromptEntryVersions.Include(v => v.Prompts)
                .ThenInclude(p => p.TemplateFields)
            .FirstAsync(v => v.EntryId == blogEntry.Id);

        var prompt = version.Prompts.First();
        prompt.IsTemplate.Should().BeTrue();
        prompt.TemplateFields.Should().NotBeEmpty();
    }
}
