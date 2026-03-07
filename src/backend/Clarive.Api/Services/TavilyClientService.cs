using Clarive.Api.Services.Interfaces;
using Microsoft.Extensions.AI;
using Microsoft.Extensions.Options;
using ModelContextProtocol.Client;

namespace Clarive.Api.Services;

public sealed class TavilyClientService : ITavilyClientService
{
    private const int TimeoutSeconds = 15;
    private const string TavilyMcpEndpoint = "https://mcp.tavily.com/mcp/";

    private readonly ILogger<TavilyClientService> _logger;
    private readonly IDisposable? _changeSubscription;
    private readonly SemaphoreSlim _initLock = new(1, 1);

    private volatile string _currentApiKey;
    private HttpClient? _httpClient;
    private McpClient? _client;
    private List<AITool>? _cachedTools;

    public bool IsConfigured => !string.IsNullOrWhiteSpace(_currentApiKey);

    public TavilyClientService(IOptionsMonitor<AiSettings> optionsMonitor, ILoggerFactory loggerFactory)
    {
        _logger = loggerFactory.CreateLogger<TavilyClientService>();
        _currentApiKey = optionsMonitor.CurrentValue.TavilyApiKey;

        _changeSubscription = optionsMonitor.OnChange(settings =>
        {
            if (settings.TavilyApiKey == _currentApiKey) return;
            _currentApiKey = settings.TavilyApiKey;
            _ = ResetClientAsync();
        });
    }

    public async Task<IList<AITool>?> GetToolsAsync(CancellationToken ct = default)
    {
        if (!IsConfigured) return null;

        await _initLock.WaitAsync(ct);
        try
        {
            if (_cachedTools is not null) return _cachedTools;

            var endpoint = $"{TavilyMcpEndpoint}?tavilyApiKey={_currentApiKey}";
            var transportOptions = new HttpClientTransportOptions
            {
                Endpoint = new Uri(endpoint),
            };
            _httpClient = new HttpClient { Timeout = TimeSpan.FromSeconds(TimeoutSeconds) };
            var transport = new HttpClientTransport(transportOptions, _httpClient);
            _client = await McpClient.CreateAsync(transport, cancellationToken: ct);

            var allTools = await _client.ListToolsAsync(cancellationToken: ct);

            _cachedTools = allTools
                .Where(t => t.Name is "tavily-search" or "tavily_search"
                                   or "tavily-extract" or "tavily_extract")
                .Cast<AITool>()
                .ToList();

            _logger.LogInformation(
                "Tavily MCP client connected, {ToolCount} tools available",
                _cachedTools.Count);

            return _cachedTools;
        }
        catch (Exception ex) when (ex is not OperationCanceledException)
        {
            _logger.LogWarning(ex, "Failed to connect to Tavily MCP server");
            _httpClient?.Dispose();
            _httpClient = null;
            return null;
        }
        finally
        {
            _initLock.Release();
        }
    }

    private async Task ResetClientAsync()
    {
        await _initLock.WaitAsync();
        try
        {
            _cachedTools = null;
            if (_client is not null)
            {
                await _client.DisposeAsync();
                _client = null;
            }
            _httpClient?.Dispose();
            _httpClient = null;

            _logger.LogInformation("Tavily MCP client reset due to configuration change");
        }
        finally
        {
            _initLock.Release();
        }
    }

    public async ValueTask DisposeAsync()
    {
        _changeSubscription?.Dispose();
        if (_client is not null)
            await _client.DisposeAsync();
        _httpClient?.Dispose();
        _initLock.Dispose();
    }
}
