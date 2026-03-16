using System.Text.Json;
using Clarive.Api.Models.Entities;
using Clarive.Api.Models.Responses;
using Clarive.Api.Repositories.Interfaces;
using Clarive.Api.Services;
using FluentAssertions;
using NSubstitute;

namespace Clarive.Api.UnitTests.Services;

public class PlaygroundRunServiceTests
{
    private readonly IPlaygroundRunRepository _runRepo = Substitute.For<IPlaygroundRunRepository>();
    private readonly PlaygroundRunService _sut;

    private static readonly JsonSerializerOptions JsonOptions = new()
    {
        PropertyNamingPolicy = JsonNamingPolicy.CamelCase
    };

    public PlaygroundRunServiceTests()
    {
        _runRepo.AddAsync(Arg.Any<PlaygroundRun>(), Arg.Any<CancellationToken>())
            .Returns(ci => ci.Arg<PlaygroundRun>());

        _sut = new PlaygroundRunService(_runRepo);
    }

    private static PlaygroundRun MakeRun(Guid? entryId = null, string model = "gpt-4o")
    {
        var responses = new List<TestRunPromptResponse> { new(0, "Test response") };
        return new PlaygroundRun
        {
            Id = Guid.NewGuid(),
            TenantId = Guid.NewGuid(),
            EntryId = entryId ?? Guid.NewGuid(),
            UserId = Guid.NewGuid(),
            Model = model,
            Temperature = 0.7f,
            MaxTokens = 1000,
            Responses = JsonSerializer.Serialize(responses, JsonOptions),
            CreatedAt = DateTime.UtcNow
        };
    }

    // ── SaveRunAsync ──

    [Fact]
    public async Task SaveRunAsync_PersistsRunAndEnforcesMaxLimit()
    {
        var run = MakeRun();

        var result = await _sut.SaveRunAsync(run, default);

        result.Should().Be(run);
        await _runRepo.Received(1).AddAsync(run, Arg.Any<CancellationToken>());
        await _runRepo.Received(1).DeleteOldestByEntryIdAsync(run.EntryId, 20, Arg.Any<CancellationToken>());
    }

    // ── GetRunsAsync ──

    [Fact]
    public async Task GetRunsAsync_ReturnsDeserializedRuns()
    {
        var entryId = Guid.NewGuid();
        var runs = new List<PlaygroundRun> { MakeRun(entryId) };
        _runRepo.GetByEntryIdAsync(entryId, 10, Arg.Any<CancellationToken>())
            .Returns(runs);

        var result = await _sut.GetRunsAsync(entryId, default);

        result.Should().HaveCount(1);
        result[0].Model.Should().Be("gpt-4o");
        result[0].Responses.Should().HaveCount(1);
        result[0].Responses[0].Content.Should().Be("Test response");
    }

    [Fact]
    public async Task GetRunsAsync_EmptyList_ReturnsEmpty()
    {
        var entryId = Guid.NewGuid();
        _runRepo.GetByEntryIdAsync(entryId, 10, Arg.Any<CancellationToken>())
            .Returns(new List<PlaygroundRun>());

        var result = await _sut.GetRunsAsync(entryId, default);

        result.Should().BeEmpty();
    }

    [Fact]
    public async Task GetRunsAsync_WithTemplateFields_DeserializesFields()
    {
        var entryId = Guid.NewGuid();
        var run = MakeRun(entryId);
        run.TemplateFieldValues = JsonSerializer.Serialize(
            new Dictionary<string, string> { ["name"] = "Alice" }, JsonOptions);

        _runRepo.GetByEntryIdAsync(entryId, 10, Arg.Any<CancellationToken>())
            .Returns([run]);

        var result = await _sut.GetRunsAsync(entryId, default);

        result[0].TemplateFieldValues.Should().ContainKey("name");
        result[0].TemplateFieldValues!["name"].Should().Be("Alice");
    }
}
