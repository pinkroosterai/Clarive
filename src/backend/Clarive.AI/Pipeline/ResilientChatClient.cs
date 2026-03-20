using Clarive.AI.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Configuration;
using System.Net;
using System.Runtime.CompilerServices;
using Microsoft.Extensions.AI;
using Microsoft.Extensions.Logging;

namespace Clarive.AI.Pipeline;

/// <summary>
/// A <see cref="DelegatingChatClient"/> that retries transient failures with exponential backoff and jitter,
/// and respects 429 Retry-After headers from AI providers.
/// </summary>
public class ResilientChatClient : DelegatingChatClient
{
    private readonly string _providerName;
    private readonly ILogger _logger;
    private readonly int _maxRetries;

    /// <summary>
    /// Delay strategy delegate, injectable for testing.
    /// </summary>
    internal Func<TimeSpan, CancellationToken, Task> DelayFunc { get; set; } = Task.Delay;

    public ResilientChatClient(
        IChatClient innerClient,
        string providerName,
        ILogger logger,
        int maxRetries = 3)
        : base(innerClient)
    {
        _providerName = providerName;
        _logger = logger;
        _maxRetries = maxRetries;
    }

    public override async Task<ChatResponse> GetResponseAsync(
        IEnumerable<ChatMessage> messages,
        ChatOptions? options = null,
        CancellationToken cancellationToken = default)
    {
        return await ExecuteWithRetryAsync(
            () => base.GetResponseAsync(messages, options, cancellationToken),
            cancellationToken);
    }

    public override async IAsyncEnumerable<ChatResponseUpdate> GetStreamingResponseAsync(
        IEnumerable<ChatMessage> messages,
        ChatOptions? options = null,
        [EnumeratorCancellation] CancellationToken cancellationToken = default)
    {
        var result = await ExecuteWithRetryAsync(
            () => Task.FromResult(base.GetStreamingResponseAsync(messages, options, cancellationToken)),
            cancellationToken);

        await foreach (var update in result.WithCancellation(cancellationToken))
        {
            yield return update;
        }
    }

    private async Task<T> ExecuteWithRetryAsync<T>(
        Func<Task<T>> operation,
        CancellationToken cancellationToken)
    {
        int? lastRetryAfterSeconds = null;
        Exception? lastException = null;

        for (var attempt = 1; attempt <= _maxRetries + 1; attempt++)
        {
            try
            {
                return await operation();
            }
            catch (Exception ex) when (ex is OperationCanceledException oce
                                       && cancellationToken.IsCancellationRequested)
            {
                // User-initiated cancellation — rethrow immediately
                throw;
            }
            catch (Exception ex) when (IsTransient(ex) && attempt <= _maxRetries)
            {
                lastException = ex;
                lastRetryAfterSeconds = ExtractRetryAfterSeconds(ex);

                var delay = GetDelay(attempt, lastRetryAfterSeconds);

                _logger.LogWarning(ex,
                    "AI provider {ProviderName} call failed (attempt {Attempt}/{MaxAttempts}), retrying in {DelayMs}ms: {ErrorMessage}",
                    _providerName, attempt, _maxRetries + 1, (int)delay.TotalMilliseconds, ex.Message);

                await DelayFunc(delay, cancellationToken);
            }
            catch (Exception ex) when (IsTransient(ex) && attempt > _maxRetries)
            {
                lastException = ex;
                lastRetryAfterSeconds = ExtractRetryAfterSeconds(ex);
                // Fall through to throw AiProviderException
                break;
            }
            // Non-transient exceptions propagate immediately (no catch)
        }

        var category = ClassifyError(lastException!);

        _logger.LogError(lastException,
            "AI provider {ProviderName} call failed after {Attempts} attempts",
            _providerName, _maxRetries + 1);

        throw new AiProviderException(
            category,
            _providerName,
            attemptsMade: _maxRetries + 1,
            retryAfterSeconds: lastRetryAfterSeconds,
            message: BuildErrorMessage(category, _providerName),
            innerException: lastException);
    }

    internal static bool IsTransient(Exception ex)
    {
        return ex switch
        {
            HttpRequestException httpEx => httpEx.StatusCode is
                HttpStatusCode.TooManyRequests or          // 429
                HttpStatusCode.InternalServerError or      // 500
                HttpStatusCode.BadGateway or               // 502
                HttpStatusCode.ServiceUnavailable or       // 503
                HttpStatusCode.GatewayTimeout,             // 504
            TimeoutException => true,
            TaskCanceledException => false, // User cancellation handled above
            _ => false
        };
    }

    private static int? ExtractRetryAfterSeconds(Exception ex)
    {
        if (ex is HttpRequestException httpEx
            && httpEx.StatusCode == HttpStatusCode.TooManyRequests)
        {
            // Some SDKs store retry-after in Data dictionary
            if (httpEx.Data.Contains("Retry-After")
                && int.TryParse(httpEx.Data["Retry-After"]?.ToString(), out var dataSeconds))
            {
                return dataSeconds;
            }

            // Try parsing from the message as a fallback (some providers include it)
            // e.g., "Rate limit exceeded. Please retry after 30 seconds"
            var message = httpEx.Message;
            var retryIndex = message.IndexOf("retry after ", StringComparison.OrdinalIgnoreCase);
            if (retryIndex >= 0)
            {
                var afterText = message[(retryIndex + 12)..];
                var numEnd = 0;
                while (numEnd < afterText.Length && char.IsDigit(afterText[numEnd])) numEnd++;
                if (numEnd > 0 && int.TryParse(afterText[..numEnd], out var parsedSeconds))
                {
                    return parsedSeconds;
                }
            }
        }

        return null;
    }

    private static TimeSpan GetDelay(int attempt, int? retryAfterSeconds)
    {
        if (retryAfterSeconds.HasValue && retryAfterSeconds.Value > 0)
        {
            return TimeSpan.FromSeconds(retryAfterSeconds.Value);
        }

        // Exponential backoff: 1s, 2s, 4s (base)
        var baseDelaySeconds = Math.Pow(2, attempt - 1);

        // ±25% jitter
        var jitter = 1.0 + (Random.Shared.NextDouble() * 0.5 - 0.25);
        var delaySeconds = baseDelaySeconds * jitter;

        return TimeSpan.FromSeconds(delaySeconds);
    }

    private static AiProviderErrorCategory ClassifyError(Exception ex)
    {
        return ex switch
        {
            HttpRequestException { StatusCode: HttpStatusCode.TooManyRequests } => AiProviderErrorCategory.RateLimited,
            TimeoutException => AiProviderErrorCategory.Timeout,
            _ => AiProviderErrorCategory.Unavailable
        };
    }

    private static string BuildErrorMessage(AiProviderErrorCategory category, string providerName)
    {
        return category switch
        {
            AiProviderErrorCategory.RateLimited =>
                $"AI provider '{providerName}' is rate limiting requests. Please try again later.",
            AiProviderErrorCategory.Timeout =>
                $"AI provider '{providerName}' request timed out. Please try again.",
            AiProviderErrorCategory.Unavailable =>
                $"AI provider '{providerName}' is temporarily unavailable. Please try again later.",
            _ => $"AI provider '{providerName}' encountered an error."
        };
    }
}
