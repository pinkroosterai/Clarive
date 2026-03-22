using Clarive.Infrastructure;
using Clarive.Infrastructure.Cache;
using Clarive.Infrastructure.Data;
using Clarive.Domain.Entities;
using Clarive.Domain.Enums;
using Clarive.Domain.ValueObjects;
using Clarive.Domain.Interfaces.Repositories;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Diagnostics;
using Microsoft.Extensions.Caching.Distributed;
using Microsoft.Extensions.Logging;
using NSubstitute;

namespace Clarive.Api.UnitTests.Services.EntryService;

public abstract class EntryServiceTestBase : IDisposable
{
    protected readonly IEntryRepository EntryRepo = Substitute.For<IEntryRepository>();
    protected readonly IFolderRepository FolderRepo = Substitute.For<IFolderRepository>();
    protected readonly ITagRepository TagRepo = Substitute.For<ITagRepository>();
    protected readonly IFavoriteRepository FavoriteRepo = Substitute.For<IFavoriteRepository>();
    protected readonly IUserRepository UserRepo = Substitute.For<IUserRepository>();
    protected readonly IAuditLogRepository AuditRepo = Substitute.For<IAuditLogRepository>();
    protected readonly TenantCacheService Cache;
    protected readonly ClariveDbContext Db;
    protected readonly Application.Entries.Services.EntryService Sut;

    protected static readonly Guid TenantId = Guid.NewGuid();
    protected static readonly Guid UserId = Guid.NewGuid();

    protected EntryServiceTestBase()
    {
        var options = new DbContextOptionsBuilder<ClariveDbContext>()
            .UseInMemoryDatabase(Guid.NewGuid().ToString())
            .ConfigureWarnings(w => w.Ignore(InMemoryEventId.TransactionIgnoredWarning))
            .Options;

        Db = new ClariveDbContext(options);
        Cache = new TenantCacheService(
            new ZiggyCreatures.Caching.Fusion.FusionCache(new ZiggyCreatures.Caching.Fusion.FusionCacheOptions())
        );
        Sut = new Application.Entries.Services.EntryService(
            EntryRepo,
            FolderRepo,
            TagRepo,
            FavoriteRepo,
            UserRepo,
            AuditRepo,
            Cache,
            new UnitOfWork(Db),
            Substitute.For<ILogger<Application.Entries.Services.EntryService>>()
        );

        // Default: CreateAsync / CreateVersionAsync return whatever is passed in
        EntryRepo
            .CreateAsync(Arg.Any<PromptEntry>(), Arg.Any<CancellationToken>())
            .Returns(ci => ci.Arg<PromptEntry>());

        EntryRepo
            .CreateVersionAsync(Arg.Any<PromptEntryVersion>(), Arg.Any<CancellationToken>())
            .Returns(ci => ci.Arg<PromptEntryVersion>());

        EntryRepo
            .UpdateAsync(Arg.Any<PromptEntry>(), Arg.Any<CancellationToken>())
            .Returns(ci => ci.Arg<PromptEntry>());

        EntryRepo
            .UpdateVersionAsync(Arg.Any<PromptEntryVersion>(), Arg.Any<CancellationToken>())
            .Returns(ci => ci.Arg<PromptEntryVersion>());
    }

    // ── Factory helpers ──────────────────────────────────────────

    protected static CreateEntryRequest ValidCreateRequest(
        string title = "Test Prompt",
        string? systemMessage = null,
        List<PromptInput>? prompts = null,
        Guid? folderId = null
    )
    {
        prompts ??= [new PromptInput("Hello {{name}}")];
        return new CreateEntryRequest(title, systemMessage, prompts, folderId);
    }

    protected static UpdateEntryRequest ValidUpdateRequest(
        string? title = "Updated Title",
        string? systemMessage = null,
        List<PromptInput>? prompts = null
    )
    {
        return new UpdateEntryRequest(title, systemMessage, prompts);
    }

    protected static PromptEntry MakeEntry(
        Guid? id = null,
        bool isTrashed = false,
        Guid? folderId = null
    )
    {
        return new PromptEntry
        {
            Id = id ?? Guid.NewGuid(),
            TenantId = TenantId,
            Title = "Existing Entry",
            FolderId = folderId,
            IsTrashed = isTrashed,
            CreatedBy = UserId,
            CreatedAt = DateTime.UtcNow.AddDays(-1),
            UpdatedAt = DateTime.UtcNow.AddDays(-1),
        };
    }

    protected static PromptEntryVersion MakeVersion(
        Guid entryId,
        int version = 1,
        VersionState state = VersionState.Draft,
        string? systemMessage = "You are helpful."
    )
    {
        return new PromptEntryVersion
        {
            Id = Guid.NewGuid(),
            EntryId = entryId,
            Version = version,
            VersionState = state,
            SystemMessage = systemMessage,
            Prompts =
            [
                new Prompt
                {
                    Id = Guid.NewGuid(),
                    Content = "Hello",
                    Order = 0,
                    IsTemplate = false,
                },
            ],
            CreatedAt = DateTime.UtcNow.AddDays(-1),
        };
    }

    protected static Folder MakeFolder(Guid? id = null)
    {
        return new Folder
        {
            Id = id ?? Guid.NewGuid(),
            TenantId = TenantId,
            Name = "Test Folder",
            CreatedAt = DateTime.UtcNow,
        };
    }

    public void Dispose()
    {
        Db.Dispose();
        GC.SuppressFinalize(this);
    }
}
