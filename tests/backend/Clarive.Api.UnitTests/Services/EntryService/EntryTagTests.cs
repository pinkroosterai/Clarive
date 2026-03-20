using Clarive.Domain.Entities;
using FluentAssertions;
using NSubstitute;

namespace Clarive.Api.UnitTests.Services.EntryService;

public class EntryTagTests : EntryServiceTestBase
{
    [Fact]
    public async Task AddEntryTagsAsync_EntryNotFound_ReturnsNotFound()
    {
        EntryRepo
            .GetByIdAsync(TenantId, Arg.Any<Guid>(), Arg.Any<CancellationToken>())
            .Returns((PromptEntry?)null);

        var result = await Sut.AddEntryTagsAsync(
            TenantId,
            Guid.NewGuid(),
            ["tag1"],
            CancellationToken.None
        );

        result.IsError.Should().BeTrue();
        result.FirstError.Type.Should().Be(ErrorOr.ErrorType.NotFound);
    }

    [Fact]
    public async Task AddEntryTagsAsync_EmptyTags_ReturnsValidationError()
    {
        var entry = MakeEntry();
        EntryRepo.GetByIdAsync(TenantId, entry.Id, Arg.Any<CancellationToken>()).Returns(entry);

        var result = await Sut.AddEntryTagsAsync(TenantId, entry.Id, [], CancellationToken.None);

        result.IsError.Should().BeTrue();
        result.FirstError.Type.Should().Be(ErrorOr.ErrorType.Validation);
    }

    [Fact]
    public async Task AddEntryTagsAsync_TagTooLong_ReturnsValidationError()
    {
        var entry = MakeEntry();
        EntryRepo.GetByIdAsync(TenantId, entry.Id, Arg.Any<CancellationToken>()).Returns(entry);

        var longTag = new string('a', 51);
        var result = await Sut.AddEntryTagsAsync(
            TenantId,
            entry.Id,
            [longTag],
            CancellationToken.None
        );

        result.IsError.Should().BeTrue();
        result.FirstError.Type.Should().Be(ErrorOr.ErrorType.Validation);
    }

    [Fact]
    public async Task AddEntryTagsAsync_InvalidPattern_ReturnsValidationError()
    {
        var entry = MakeEntry();
        EntryRepo.GetByIdAsync(TenantId, entry.Id, Arg.Any<CancellationToken>()).Returns(entry);

        var result = await Sut.AddEntryTagsAsync(
            TenantId,
            entry.Id,
            ["invalid@tag!"],
            CancellationToken.None
        );

        result.IsError.Should().BeTrue();
        result.FirstError.Type.Should().Be(ErrorOr.ErrorType.Validation);
    }

    [Fact]
    public async Task AddEntryTagsAsync_ValidTags_NormalizesAndReturnsUpdatedList()
    {
        var entry = MakeEntry();
        EntryRepo.GetByIdAsync(TenantId, entry.Id, Arg.Any<CancellationToken>()).Returns(entry);
        TagRepo
            .GetByEntryIdAsync(TenantId, entry.Id, Arg.Any<CancellationToken>())
            .Returns(new List<string> { "existing", "new-tag" });

        var result = await Sut.AddEntryTagsAsync(
            TenantId,
            entry.Id,
            ["  New-Tag  ", "NEW-TAG"],
            CancellationToken.None
        );

        result.IsError.Should().BeFalse();
        result.Value.Should().Contain("new-tag");

        // Verify normalized and deduplicated tags were passed to repo
        await TagRepo
            .Received(1)
            .AddAsync(
                TenantId,
                entry.Id,
                Arg.Is<List<string>>(t => t.Count == 1 && t[0] == "new-tag"),
                Arg.Any<CancellationToken>()
            );
    }

    [Fact]
    public async Task GetEntryTagsAsync_EntryNotFound_ReturnsNotFound()
    {
        EntryRepo
            .GetByIdAsync(TenantId, Arg.Any<Guid>(), Arg.Any<CancellationToken>())
            .Returns((PromptEntry?)null);

        var result = await Sut.GetEntryTagsAsync(TenantId, Guid.NewGuid(), CancellationToken.None);

        result.IsError.Should().BeTrue();
        result.FirstError.Type.Should().Be(ErrorOr.ErrorType.NotFound);
    }

    [Fact]
    public async Task RemoveEntryTagAsync_EntryNotFound_ReturnsNotFound()
    {
        EntryRepo
            .GetByIdAsync(TenantId, Arg.Any<Guid>(), Arg.Any<CancellationToken>())
            .Returns((PromptEntry?)null);

        var result = await Sut.RemoveEntryTagAsync(
            TenantId,
            Guid.NewGuid(),
            "tag1",
            CancellationToken.None
        );

        result.IsError.Should().BeTrue();
        result.FirstError.Type.Should().Be(ErrorOr.ErrorType.NotFound);
    }

    [Fact]
    public async Task RemoveEntryTagAsync_ValidTag_NormalizesAndRemoves()
    {
        var entry = MakeEntry();
        EntryRepo.GetByIdAsync(TenantId, entry.Id, Arg.Any<CancellationToken>()).Returns(entry);

        var result = await Sut.RemoveEntryTagAsync(
            TenantId,
            entry.Id,
            "  My-Tag  ",
            CancellationToken.None
        );

        result.IsError.Should().BeFalse();
        await TagRepo
            .Received(1)
            .RemoveAsync(TenantId, entry.Id, "my-tag", Arg.Any<CancellationToken>());
    }
}
