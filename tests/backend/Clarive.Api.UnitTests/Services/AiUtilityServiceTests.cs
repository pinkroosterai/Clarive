using Clarive.AI.Agents;
using Clarive.AI.Orchestration;
using Clarive.AI.Pipeline;
using Clarive.Domain.Entities;
using Clarive.Domain.Interfaces.Repositories;
using Clarive.Domain.Interfaces.Services;
using Clarive.Domain.ValueObjects;
using FluentAssertions;
using NSubstitute;

namespace Clarive.Api.UnitTests.Services;

public class AiUtilityServiceTests
{
    private readonly IPromptOrchestrator _orchestrator = Substitute.For<IPromptOrchestrator>();
    private readonly IEntryRepository _entryRepo = Substitute.For<IEntryRepository>();
    private readonly IAiUsageLogger _usageLogger = Substitute.For<IAiUsageLogger>();
    private readonly IAgentFactory _agentFactory = Substitute.For<IAgentFactory>();
    private readonly AiUtilityService _sut;

    private static readonly Guid TenantId = Guid.NewGuid();
    private static readonly Guid UserId = Guid.NewGuid();
    private static readonly Guid EntryId = Guid.NewGuid();

    public AiUtilityServiceTests()
    {
        _sut = new AiUtilityService(_orchestrator, _entryRepo, _usageLogger, _agentFactory);
    }

    // ── GenerateSystemMessageAsync ──

    [Fact]
    public async Task GenerateSystemMessageAsync_EntryNotFound_ReturnsNotFound()
    {
        _entryRepo
            .GetByIdAsync(TenantId, EntryId, Arg.Any<CancellationToken>())
            .Returns((PromptEntry?)null);

        var result = await _sut.GenerateSystemMessageAsync(TenantId, UserId, EntryId, null, default);

        result.IsError.Should().BeTrue();
        result.FirstError.Code.Should().Be("ENTRY_NOT_FOUND");
    }

    [Fact]
    public async Task GenerateSystemMessageAsync_AlreadyHasSystemMessage_ReturnsConflict()
    {
        _entryRepo
            .GetByIdAsync(TenantId, EntryId, Arg.Any<CancellationToken>())
            .Returns(new PromptEntry { Id = EntryId, IsTrashed = false });
        _entryRepo
            .GetWorkingVersionAsync(TenantId, EntryId, Arg.Any<Guid?>(), Arg.Any<CancellationToken>())
            .Returns(
                new PromptEntryVersion
                {
                    SystemMessage = "Existing system message",
                    Prompts = [new Prompt { Content = "Test", Order = 0 }],
                }
            );

        var result = await _sut.GenerateSystemMessageAsync(TenantId, UserId, EntryId, null, default);

        result.IsError.Should().BeTrue();
        result.FirstError.Code.Should().Be("ALREADY_EXISTS");
    }

    [Fact]
    public async Task GenerateSystemMessageAsync_Valid_CallsOrchestratorAndReturnsMessage()
    {
        _entryRepo
            .GetByIdAsync(TenantId, EntryId, Arg.Any<CancellationToken>())
            .Returns(new PromptEntry { Id = EntryId, IsTrashed = false });
        _entryRepo
            .GetWorkingVersionAsync(TenantId, EntryId, Arg.Any<Guid?>(), Arg.Any<CancellationToken>())
            .Returns(
                new PromptEntryVersion
                {
                    SystemMessage = null,
                    Prompts = [new Prompt { Content = "Test prompt", Order = 0 }],
                }
            );
        _orchestrator
            .GenerateSystemMessageAsync(Arg.Any<List<PromptInput>>(), Arg.Any<CancellationToken>())
            .Returns(new AgentResult<string>("Generated system message"));

        var result = await _sut.GenerateSystemMessageAsync(TenantId, UserId, EntryId, null, default);

        result.IsError.Should().BeFalse();
        result.Value.Should().Be("Generated system message");
    }

    // ── DecomposeAsync ──

    [Fact]
    public async Task DecomposeAsync_EntryNotFound_ReturnsNotFound()
    {
        _entryRepo
            .GetByIdAsync(TenantId, EntryId, Arg.Any<CancellationToken>())
            .Returns((PromptEntry?)null);

        var result = await _sut.DecomposeAsync(TenantId, UserId, EntryId, null, default);

        result.IsError.Should().BeTrue();
        result.FirstError.Code.Should().Be("ENTRY_NOT_FOUND");
    }

    [Fact]
    public async Task DecomposeAsync_MultiplePrompts_ReturnsConflict()
    {
        _entryRepo
            .GetByIdAsync(TenantId, EntryId, Arg.Any<CancellationToken>())
            .Returns(new PromptEntry { Id = EntryId, IsTrashed = false });
        _entryRepo
            .GetWorkingVersionAsync(TenantId, EntryId, Arg.Any<Guid?>(), Arg.Any<CancellationToken>())
            .Returns(
                new PromptEntryVersion
                {
                    Prompts =
                    [
                        new Prompt { Content = "P1", Order = 0 },
                        new Prompt { Content = "P2", Order = 1 },
                    ],
                }
            );

        var result = await _sut.DecomposeAsync(TenantId, UserId, EntryId, null, default);

        result.IsError.Should().BeTrue();
        result.FirstError.Code.Should().Be("ALREADY_CHAIN");
    }

    [Fact]
    public async Task DecomposeAsync_Valid_CallsOrchestratorAndReturnsDecomposed()
    {
        _entryRepo
            .GetByIdAsync(TenantId, EntryId, Arg.Any<CancellationToken>())
            .Returns(new PromptEntry { Id = EntryId, IsTrashed = false });
        _entryRepo
            .GetWorkingVersionAsync(TenantId, EntryId, Arg.Any<Guid?>(), Arg.Any<CancellationToken>())
            .Returns(
                new PromptEntryVersion
                {
                    Prompts =
                    [
                        new Prompt
                        {
                            Content = "Original prompt",
                            Order = 0,
                            IsTemplate = false,
                        },
                    ],
                }
            );
        _orchestrator
            .DecomposeAsync(
                Arg.Any<string>(),
                Arg.Any<bool>(),
                Arg.Any<string?>(),
                Arg.Any<CancellationToken>()
            )
            .Returns(
                new AgentResult<List<PromptInput>>(
                    new List<PromptInput>
                    {
                        new("Step 1", false),
                        new("Step 2", false),
                        new("Step 3", false),
                    }
                )
            );

        var result = await _sut.DecomposeAsync(TenantId, UserId, EntryId, null, default);

        result.IsError.Should().BeFalse();
        result.Value.Should().HaveCount(3);
    }
}
