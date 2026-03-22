using Clarive.Domain.Interfaces.Services;
using Clarive.AI.Models;
using Clarive.AI.Pipeline;
using Clarive.AI.Agents;
using Clarive.AI.Orchestration;
using Clarive.Domain.ValueObjects;
using Clarive.Domain.Entities;
using Clarive.Domain.Enums;
using Clarive.Domain.Interfaces.Repositories;
using FluentAssertions;
using Microsoft.Extensions.AI;
using NSubstitute;

namespace Clarive.Api.UnitTests.Services;

public class AiGenerationServiceTests
{
    private readonly IPromptOrchestrator _orchestrator = Substitute.For<IPromptOrchestrator>();
    private readonly IAiSessionRepository _sessionRepo = Substitute.For<IAiSessionRepository>();
    private readonly IEntryRepository _entryRepo = Substitute.For<IEntryRepository>();
    private readonly IToolRepository _toolRepo = Substitute.For<IToolRepository>();
    private readonly IAiUsageLogger _usageLogger = Substitute.For<IAiUsageLogger>();
    private readonly IAgentFactory _agentFactory = Substitute.For<IAgentFactory>();
    private readonly AiGenerationService _sut;

    private static readonly Guid TenantId = Guid.NewGuid();
    private static readonly Guid UserId = Guid.NewGuid();
    private static readonly Guid EntryId = Guid.NewGuid();

    public AiGenerationServiceTests()
    {
        _sessionRepo
            .CreateAsync(Arg.Any<AiSession>(), Arg.Any<CancellationToken>())
            .Returns(ci => ci.Arg<AiSession>());

        _agentFactory.GetModelInfo(Arg.Any<AiActionType>()).Returns(("gpt-4o", "OpenAI"));

        _sut = new AiGenerationService(
            _orchestrator,
            _sessionRepo,
            _entryRepo,
            _toolRepo,
            _usageLogger,
            _agentFactory
        );
    }

    private static GenerateOrchestratorResult MakeOrchestratorResult() =>
        new(
            AgentSessionId: "agent-123",
            Prompts: new PromptSet
            {
                Title = "Test Title",
                SystemMessage = "System msg",
                Prompts = [new PromptMessage { Content = "Content", IsTemplate = false }],
            },
            Evaluation: new PromptEvaluation
            {
                PromptEvaluations = new Dictionary<string, PromptEvaluationEntry>
                {
                    ["clarity"] = new() { Score = 8, Feedback = "Clear" },
                    ["relevance"] = new() { Score = 7, Feedback = "Good" },
                },
            },
            Clarification: new ClarificationResult
            {
                Questions = [new ClarificationQuestion { Text = "Q1", Suggestions = ["A", "B"] }],
                Enhancements = ["Enhance 1"],
            }
        );

    // ── GenerateAsync ──

    [Fact]
    public async Task GenerateAsync_PersistsSessionAndReturnsResult()
    {
        var request = new GeneratePromptRequest(
            "Create a blog post prompt",
            GenerateSystemMessage: true,
            GenerateTemplate: false,
            GenerateChain: false,
            ToolIds: null,
            EnableWebSearch: false
        );

        _orchestrator
            .GenerateAsync(
                Arg.Any<GenerationConfig>(),
                Arg.Any<CancellationToken>(),
                Arg.Any<Func<ProgressEvent, Task>?>()
            )
            .Returns(MakeOrchestratorResult());

        var result = await _sut.GenerateAsync(TenantId, UserId, request, default);

        result.SessionId.Should().NotBeEmpty();
        result.Draft.Should().NotBeNull();
        result.Draft.Title.Should().Be("Test Title");
        result.Questions.Should().HaveCount(1);
        result.Enhancements.Should().HaveCount(1);
        result.Evaluation.Should().NotBeNull();
        result.ScoreHistory.Should().HaveCount(1);
        await _sessionRepo
            .Received(1)
            .CreateAsync(
                Arg.Is<AiSession>(s => s.TenantId == TenantId && s.AgentSessionId == "agent-123"),
                Arg.Any<CancellationToken>()
            );
    }

    [Fact]
    public async Task GenerateAsync_WithToolIds_BuildsConfigWithTools()
    {
        var toolId = Guid.NewGuid();
        var request = new GeneratePromptRequest(
            "Test",
            GenerateSystemMessage: false,
            GenerateTemplate: false,
            GenerateChain: false,
            ToolIds: [toolId],
            EnableWebSearch: false
        );

        _toolRepo
            .GetByIdsAsync(TenantId, Arg.Any<List<Guid>>(), Arg.Any<CancellationToken>())
            .Returns([new ToolDescription { Name = "Tool1", Description = "Desc1" }]);
        _orchestrator
            .GenerateAsync(
                Arg.Any<GenerationConfig>(),
                Arg.Any<CancellationToken>(),
                Arg.Any<Func<ProgressEvent, Task>?>()
            )
            .Returns(MakeOrchestratorResult());

        await _sut.GenerateAsync(TenantId, UserId, request, default);

        await _toolRepo
            .Received(1)
            .GetByIdsAsync(TenantId, Arg.Any<List<Guid>>(), Arg.Any<CancellationToken>());
        await _orchestrator
            .Received(1)
            .GenerateAsync(
                Arg.Is<GenerationConfig>(c => c.SelectedTools.Count == 1),
                Arg.Any<CancellationToken>(),
                Arg.Any<Func<ProgressEvent, Task>?>()
            );
    }

    // ── RefineAsync ──

    [Fact]
    public async Task RefineAsync_SessionNotFound_ReturnsNotFound()
    {
        _sessionRepo
            .GetByIdAsync(TenantId, Arg.Any<Guid>(), Arg.Any<CancellationToken>())
            .Returns((AiSession?)null);

        var result = await _sut.RefineAsync(
            TenantId,
            UserId,
            new RefinePromptRequest(Guid.NewGuid(), null, null),
            default
        );

        result.IsError.Should().BeTrue();
        result.FirstError.Code.Should().Be("SESSION_NOT_FOUND");
    }

    [Fact]
    public async Task RefineAsync_NoAgentSession_ReturnsValidationError()
    {
        _sessionRepo
            .GetByIdAsync(TenantId, Arg.Any<Guid>(), Arg.Any<CancellationToken>())
            .Returns(
                new AiSession
                {
                    Id = Guid.NewGuid(),
                    TenantId = TenantId,
                    AgentSessionId = null,
                    Config = null,
                    Questions = [],
                    Enhancements = [],
                    ScoreHistory = [],
                }
            );

        var result = await _sut.RefineAsync(
            TenantId,
            UserId,
            new RefinePromptRequest(Guid.NewGuid(), null, null),
            default
        );

        result.IsError.Should().BeTrue();
        result.FirstError.Code.Should().Be("VALIDATION_ERROR");
    }

    // ── EnhanceAsync ──

    [Fact]
    public async Task EnhanceAsync_EntryNotFound_ReturnsNotFound()
    {
        _entryRepo
            .GetByIdAsync(TenantId, EntryId, Arg.Any<CancellationToken>())
            .Returns((PromptEntry?)null);

        var result = await _sut.EnhanceAsync(TenantId, UserId, EntryId, default);

        result.IsError.Should().BeTrue();
        result.FirstError.Code.Should().Be("ENTRY_NOT_FOUND");
    }

    [Fact]
    public async Task EnhanceAsync_TrashedEntry_ReturnsNotFound()
    {
        _entryRepo
            .GetByIdAsync(TenantId, EntryId, Arg.Any<CancellationToken>())
            .Returns(new PromptEntry { Id = EntryId, IsTrashed = true });

        var result = await _sut.EnhanceAsync(TenantId, UserId, EntryId, default);

        result.IsError.Should().BeTrue();
        result.FirstError.Code.Should().Be("ENTRY_NOT_FOUND");
    }

    [Fact]
    public async Task EnhanceAsync_NoVersion_ReturnsNotFound()
    {
        _entryRepo
            .GetByIdAsync(TenantId, EntryId, Arg.Any<CancellationToken>())
            .Returns(new PromptEntry { Id = EntryId, IsTrashed = false });
        _entryRepo
            .GetWorkingVersionAsync(TenantId, EntryId, Arg.Any<CancellationToken>())
            .Returns((PromptEntryVersion?)null);

        var result = await _sut.EnhanceAsync(TenantId, UserId, EntryId, default);

        result.IsError.Should().BeTrue();
        result.FirstError.Code.Should().Be("VERSION_NOT_FOUND");
    }

    // ── GenerateSystemMessageAsync ──

    [Fact]
    public async Task GenerateSystemMessageAsync_EntryNotFound_ReturnsNotFound()
    {
        _entryRepo
            .GetByIdAsync(TenantId, EntryId, Arg.Any<CancellationToken>())
            .Returns((PromptEntry?)null);

        var result = await _sut.GenerateSystemMessageAsync(TenantId, UserId, EntryId, default);

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
            .GetWorkingVersionAsync(TenantId, EntryId, Arg.Any<CancellationToken>())
            .Returns(
                new PromptEntryVersion
                {
                    SystemMessage = "Existing system message",
                    Prompts = [new Prompt { Content = "Test", Order = 0 }],
                }
            );

        var result = await _sut.GenerateSystemMessageAsync(TenantId, UserId, EntryId, default);

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
            .GetWorkingVersionAsync(TenantId, EntryId, Arg.Any<CancellationToken>())
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

        var result = await _sut.GenerateSystemMessageAsync(TenantId, UserId, EntryId, default);

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

        var result = await _sut.DecomposeAsync(TenantId, UserId, EntryId, default);

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
            .GetWorkingVersionAsync(TenantId, EntryId, Arg.Any<CancellationToken>())
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

        var result = await _sut.DecomposeAsync(TenantId, UserId, EntryId, default);

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
            .GetWorkingVersionAsync(TenantId, EntryId, Arg.Any<CancellationToken>())
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

        var result = await _sut.DecomposeAsync(TenantId, UserId, EntryId, default);

        result.IsError.Should().BeFalse();
        result.Value.Should().HaveCount(3);
    }
}
