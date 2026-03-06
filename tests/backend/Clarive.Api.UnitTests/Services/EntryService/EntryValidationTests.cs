using FluentAssertions;
using Clarive.Api.Models.Requests;

namespace Clarive.Api.UnitTests.Services.EntryService;

public class EntryValidationTests : EntryServiceTestBase
{
    // ── ValidateCreateRequest ────────────────────────────────────

    [Fact]
    public void ValidateCreate_NullTitle_ReturnsError()
    {
        var request = new CreateEntryRequest(null!, null, [new PromptInput("hi")], null);

        Sut.ValidateCreateRequest(request).Should().Be("Title is required.");
    }

    [Fact]
    public void ValidateCreate_WhitespaceTitle_ReturnsError()
    {
        var request = new CreateEntryRequest("   ", null, [new PromptInput("hi")], null);

        Sut.ValidateCreateRequest(request).Should().Be("Title is required.");
    }

    [Fact]
    public void ValidateCreate_TitleTooLong_ReturnsError()
    {
        var longTitle = new string('A', 501);
        var request = new CreateEntryRequest(longTitle, null, [new PromptInput("hi")], null);

        Sut.ValidateCreateRequest(request).Should().Be("Title must be 500 characters or fewer.");
    }

    [Fact]
    public void ValidateCreate_NullPrompts_ReturnsError()
    {
        var request = new CreateEntryRequest("Title", null, null!, null);

        Sut.ValidateCreateRequest(request).Should().Be("At least one prompt is required.");
    }

    [Fact]
    public void ValidateCreate_EmptyPrompts_ReturnsError()
    {
        var request = new CreateEntryRequest("Title", null, [], null);

        Sut.ValidateCreateRequest(request).Should().Be("At least one prompt is required.");
    }

    [Fact]
    public void ValidateCreate_OversizedContent_ReturnsError()
    {
        var huge = new string('X', 100_001);
        var request = new CreateEntryRequest("Title", null, [new PromptInput(huge)], null);

        Sut.ValidateCreateRequest(request).Should()
            .Contain("exceeds maximum length");
    }

    [Fact]
    public void ValidateCreate_TitleExactly500Chars_ReturnsNull()
    {
        var request = new CreateEntryRequest(new string('a', 500), null, [new PromptInput("hi")], null);

        Sut.ValidateCreateRequest(request).Should().BeNull();
    }

    [Fact]
    public void ValidateCreate_ValidRequest_ReturnsNull()
    {
        var request = ValidCreateRequest();

        Sut.ValidateCreateRequest(request).Should().BeNull();
    }

    // ── ValidateUpdateRequest ────────────────────────────────────

    [Fact]
    public void ValidateUpdate_TitleTooLong_ReturnsError()
    {
        var request = new UpdateEntryRequest(new string('A', 501), null, null);

        Sut.ValidateUpdateRequest(request).Should().Be("Title must be 500 characters or fewer.");
    }

    [Fact]
    public void ValidateUpdate_OversizedContent_ReturnsError()
    {
        var huge = new string('X', 100_001);
        var request = new UpdateEntryRequest(null, null, [new PromptInput(huge)]);

        Sut.ValidateUpdateRequest(request).Should()
            .Contain("exceeds maximum length");
    }

    [Fact]
    public void ValidateUpdate_ValidRequest_ReturnsNull()
    {
        var request = ValidUpdateRequest();

        Sut.ValidateUpdateRequest(request).Should().BeNull();
    }
}
