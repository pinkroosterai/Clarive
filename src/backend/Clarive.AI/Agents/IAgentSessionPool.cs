using Clarive.AI.Services;
using Clarive.AI.Models;
using Clarive.Domain.ValueObjects;
using Clarive.AI.Extensions;
using Microsoft.Agents.AI;
using Microsoft.Extensions.AI;

namespace Clarive.AI.Agents;

/// <summary>
/// Manages in-memory agent sessions with TTL-based cleanup.
/// Sessions preserve multi-turn conversation context for the generation agent.
/// </summary>
public interface IAgentSessionPool
{
    /// <summary>
    /// Creates a new generation agent + session pair and returns a correlation ID.
    /// Throws InvalidOperationException if the pool is at capacity.
    /// </summary>
    Task<string> CreateSessionAsync(
        GenerationConfig config,
        CancellationToken ct = default,
        IList<AITool>? tools = null,
        EnhanceContext? enhanceContext = null
    );

    /// <summary>
    /// Retrieves an existing agent session. Returns null if expired or not found.
    /// </summary>
    AgentSessionEntry? Get(string sessionId);

    /// <summary>
    /// Removes a session from the pool (e.g., after save).
    /// </summary>
    void Remove(string sessionId);

    /// <summary>
    /// Invalidates all active sessions (e.g., after AI config change).
    /// </summary>
    void InvalidateAll();
}

/// <summary>
/// Existing prompt content stored for enhance-mode sessions.
/// Injected into the first refinement task instead of making a wasteful bootstrap LLM call.
/// </summary>
public record EnhanceContext(string? SystemMessage, List<PromptInput> Prompts);

public record AgentSessionEntry(
    AIAgent Agent,
    AgentSession Session,
    DateTime CreatedAt,
    ToolProgressReporter? ToolProgress = null
)
{
    /// <summary>
    /// Serializes concurrent access to the agent session (e.g., two /refine requests).
    /// </summary>
    public SemaphoreSlim Lock { get; } = new(1, 1);

    /// <summary>
    /// Existing prompt content for enhance-mode sessions. Consumed (set to null)
    /// on the first refinement to provide context without a wasteful bootstrap LLM call.
    /// </summary>
    public EnhanceContext? PendingEnhanceContext { get; set; }
}
