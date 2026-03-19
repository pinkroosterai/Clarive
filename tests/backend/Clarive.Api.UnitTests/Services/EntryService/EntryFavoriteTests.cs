using Clarive.Api.Models.Entities;
using FluentAssertions;
using NSubstitute;

namespace Clarive.Api.UnitTests.Services.EntryService;

public class EntryFavoriteTests : EntryServiceTestBase
{
    [Fact]
    public async Task FavoriteEntryAsync_EntryNotFound_ReturnsNotFound()
    {
        EntryRepo
            .GetByIdAsync(TenantId, Arg.Any<Guid>(), Arg.Any<CancellationToken>())
            .Returns((PromptEntry?)null);

        var result = await Sut.FavoriteEntryAsync(
            TenantId,
            UserId,
            Guid.NewGuid(),
            CancellationToken.None
        );

        result.IsError.Should().BeTrue();
        result.FirstError.Type.Should().Be(ErrorOr.ErrorType.NotFound);
    }

    [Fact]
    public async Task FavoriteEntryAsync_AlreadyFavorited_ReturnsSuccessWithoutDuplicate()
    {
        var entry = MakeEntry();
        EntryRepo.GetByIdAsync(TenantId, entry.Id, Arg.Any<CancellationToken>()).Returns(entry);
        FavoriteRepo
            .ExistsAsync(TenantId, UserId, entry.Id, Arg.Any<CancellationToken>())
            .Returns(true);

        var result = await Sut.FavoriteEntryAsync(
            TenantId,
            UserId,
            entry.Id,
            CancellationToken.None
        );

        result.IsError.Should().BeFalse();
        await FavoriteRepo
            .DidNotReceive()
            .AddAsync(Arg.Any<EntryFavorite>(), Arg.Any<CancellationToken>());
    }

    [Fact]
    public async Task FavoriteEntryAsync_NotYetFavorited_AddsFavorite()
    {
        var entry = MakeEntry();
        EntryRepo.GetByIdAsync(TenantId, entry.Id, Arg.Any<CancellationToken>()).Returns(entry);
        FavoriteRepo
            .ExistsAsync(TenantId, UserId, entry.Id, Arg.Any<CancellationToken>())
            .Returns(false);

        var result = await Sut.FavoriteEntryAsync(
            TenantId,
            UserId,
            entry.Id,
            CancellationToken.None
        );

        result.IsError.Should().BeFalse();
        await FavoriteRepo
            .Received(1)
            .AddAsync(
                Arg.Is<EntryFavorite>(f =>
                    f.TenantId == TenantId && f.UserId == UserId && f.EntryId == entry.Id
                ),
                Arg.Any<CancellationToken>()
            );
    }

    [Fact]
    public async Task UnfavoriteEntryAsync_ReturnsSuccess()
    {
        var result = await Sut.UnfavoriteEntryAsync(
            TenantId,
            UserId,
            Guid.NewGuid(),
            CancellationToken.None
        );

        result.IsError.Should().BeFalse();
    }
}
