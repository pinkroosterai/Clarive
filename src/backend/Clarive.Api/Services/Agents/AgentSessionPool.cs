using System.Collections.Concurrent;
using Clarive.Api.Models.Agents;
using Microsoft.Agents.AI;
using Microsoft.Extensions.AI;

namespace Clarive.Api.Services.Agents;

/// <summary>
/// Singleton pool managing in-memory agent sessions.
/// 30-minute TTL with 5-minute cleanup interval, bounded to MaxPoolSize.
/// </summary>
public class AgentSessionPool : IAgentSessionPool, IDisposable
{
    private static readonly TimeSpan SessionTtl = TimeSpan.FromMinutes(30);
    private static readonly TimeSpan CleanupInterval = TimeSpan.FromMinutes(5);

    private readonly ConcurrentDictionary<string, AgentSessionEntry> _sessions = new();
    private readonly IAgentFactory _factory;
    private readonly ILogger<AgentSessionPool> _logger;
    private readonly Timer _cleanupTimer;
    private readonly int _maxPoolSize;

    public AgentSessionPool(IAgentFactory factory, ILogger<AgentSessionPool> logger, IConfiguration configuration)
    {
        _factory = factory;
        _logger = logger;
        _maxPoolSize = configuration.GetValue("Ai:MaxAgentSessions", 100);
        _cleanupTimer = new Timer(CleanupExpired, null, CleanupInterval, CleanupInterval);

        _factory.OnReconfigured += InvalidateAll;
    }

    public async Task<string> CreateSessionAsync(GenerationConfig config, CancellationToken ct = default, IList<AITool>? tools = null)
    {
        if (_sessions.Count >= _maxPoolSize)
        {
            // Try an immediate cleanup before rejecting
            CleanupExpired(null);

            if (_sessions.Count >= _maxPoolSize)
                throw new InvalidOperationException(
                    $"Agent session pool is at capacity ({_maxPoolSize}). Please try again later.");
        }

        var agent = _factory.CreateGenerationAgent(config, tools);
        var session = await agent.CreateSessionAsync(ct);
        var id = Guid.NewGuid().ToString("N");

        var entry = new AgentSessionEntry(agent, session, DateTime.UtcNow);
        _sessions[id] = entry;

        _logger.LogDebug("Created agent session {SessionId}, pool size: {Count}", id, _sessions.Count);
        return id;
    }

    public AgentSessionEntry? Get(string sessionId)
    {
        if (!_sessions.TryGetValue(sessionId, out var entry))
            return null;

        if (DateTime.UtcNow - entry.CreatedAt > SessionTtl)
        {
            if (_sessions.TryRemove(sessionId, out var expired))
                DisposeEntry(expired);
            _logger.LogInformation("Agent session {SessionId} expired (TTL exceeded)", sessionId);
            return null;
        }

        return entry;
    }

    public void Remove(string sessionId)
    {
        if (_sessions.TryRemove(sessionId, out var entry))
            DisposeEntry(entry);
    }

    public void InvalidateAll()
    {
        var count = 0;
        foreach (var kvp in _sessions)
        {
            if (_sessions.TryRemove(kvp.Key, out var entry))
            {
                DisposeEntry(entry);
                count++;
            }
        }

        if (count > 0)
            _logger.LogInformation("Invalidated {Count} agent sessions due to AI config change", count);
    }

    private void CleanupExpired(object? state)
    {
        var cutoff = DateTime.UtcNow - SessionTtl;
        var removed = 0;

        foreach (var kvp in _sessions)
        {
            if (kvp.Value.CreatedAt < cutoff && _sessions.TryRemove(kvp.Key, out var entry))
            {
                DisposeEntry(entry);
                removed++;
            }
        }

        if (removed > 0)
            _logger.LogInformation("Cleaned up {Count} expired agent sessions, pool size: {Remaining}",
                removed, _sessions.Count);
    }

    private static void DisposeEntry(AgentSessionEntry entry)
    {
        entry.Lock.Dispose();
        (entry.Agent as IDisposable)?.Dispose();
        (entry.Session as IDisposable)?.Dispose();
    }

    public void Dispose()
    {
        _factory.OnReconfigured -= InvalidateAll;
        _cleanupTimer.Dispose();
        foreach (var kvp in _sessions)
        {
            if (_sessions.TryRemove(kvp.Key, out var entry))
                DisposeEntry(entry);
        }
    }
}
