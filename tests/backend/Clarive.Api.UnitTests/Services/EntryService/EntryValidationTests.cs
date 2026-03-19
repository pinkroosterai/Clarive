using Clarive.Api.Models.Requests;
using FluentAssertions;
using MiniValidation;
using NSubstitute;

namespace Clarive.Api.UnitTests.Services.EntryService;

public class EntryValidationTests : EntryServiceTestBase
{
    // ── Data Annotation validation (MiniValidation) ──────────────

    [Fact]
    public void CreateRequest_NullTitle_FailsValidation()
    {
        var request = new CreateEntryRequest(null!, null, [new PromptInput("hi")], null);

        MiniValidator.TryValidate(request, out var errors).Should().BeFalse();
        errors.Should().ContainKey(nameof(CreateEntryRequest.Title));
    }

    [Fact]
    public void CreateRequest_TitleTooLong_FailsValidation()
    {
        var longTitle = new string('A', 501);
        var request = new CreateEntryRequest(longTitle, null, [new PromptInput("hi")], null);

        MiniValidator.TryValidate(request, out var errors).Should().BeFalse();
        errors.Should().ContainKey(nameof(CreateEntryRequest.Title));
    }

    [Fact]
    public void CreateRequest_NullPrompts_FailsValidation()
    {
        var request = new CreateEntryRequest("Title", null, null!, null);

        MiniValidator.TryValidate(request, out var errors).Should().BeFalse();
        errors.Should().ContainKey(nameof(CreateEntryRequest.Prompts));
    }

    [Fact]
    public void CreateRequest_EmptyPrompts_FailsValidation()
    {
        var request = new CreateEntryRequest("Title", null, [], null);

        MiniValidator.TryValidate(request, out var errors).Should().BeFalse();
        errors.Should().ContainKey(nameof(CreateEntryRequest.Prompts));
    }

    [Fact]
    public void CreateRequest_TitleExactly500Chars_PassesValidation()
    {
        var request = new CreateEntryRequest(
            new string('a', 500),
            null,
            [new PromptInput("hi")],
            null
        );

        MiniValidator.TryValidate(request, out _).Should().BeTrue();
    }

    [Fact]
    public void CreateRequest_ValidRequest_PassesValidation()
    {
        var request = ValidCreateRequest();

        MiniValidator.TryValidate(request, out _).Should().BeTrue();
    }

    [Fact]
    public void UpdateRequest_TitleTooLong_FailsValidation()
    {
        var request = new UpdateEntryRequest(new string('A', 501), null, null);

        MiniValidator.TryValidate(request, out var errors).Should().BeFalse();
        errors.Should().ContainKey(nameof(UpdateEntryRequest.Title));
    }

    [Fact]
    public void UpdateRequest_ValidRequest_PassesValidation()
    {
        var request = ValidUpdateRequest();

        MiniValidator.TryValidate(request, out _).Should().BeTrue();
    }

    // ── Prompt content length validation (service layer) ─────────

    [Fact]
    public async Task CreateEntryAsync_OversizedContent_ReturnsValidationError()
    {
        var huge = new string('X', 100_001);
        var request = new CreateEntryRequest("Title", null, [new PromptInput(huge)], null);

        var result = await Sut.CreateEntryAsync(TenantId, UserId, request, CancellationToken.None);

        result.IsError.Should().BeTrue();
        result.FirstError.Code.Should().Be("VALIDATION_ERROR");
        result.FirstError.Description.Should().Contain("exceeds maximum length");
    }

    [Fact]
    public async Task UpdateEntryAsync_OversizedContent_ReturnsValidationError()
    {
        var huge = new string('X', 100_001);
        var entry = MakeEntry();
        EntryRepo.GetByIdAsync(TenantId, entry.Id, Arg.Any<CancellationToken>()).Returns(entry);

        var request = new UpdateEntryRequest(null, null, [new PromptInput(huge)]);

        var result = await Sut.UpdateEntryAsync(
            TenantId,
            entry.Id,
            request,
            CancellationToken.None
        );

        result.IsError.Should().BeTrue();
        result.FirstError.Code.Should().Be("VALIDATION_ERROR");
        result.FirstError.Description.Should().Contain("exceeds maximum length");
    }
}
