using Clarive.AI.Services;
using Clarive.AI.Models;
using Clarive.AI.Extensions;
using Clarive.AI.Agents;
using System.Net;
using FluentAssertions;
using Microsoft.Extensions.AI;
using Microsoft.Extensions.Logging;
using NSubstitute;
using NSubstitute.ExceptionExtensions;

namespace Clarive.Api.UnitTests.Services;

public class ResilientChatClientTests
{
    private readonly IChatClient _innerClient = Substitute.For<IChatClient>();
    private readonly ILogger _logger = Substitute.For<ILogger>();
    private readonly List<TimeSpan> _delays = [];

    private ResilientChatClient CreateSut(int maxRetries = 3)
    {
        var sut = new ResilientChatClient(_innerClient, "TestProvider", _logger, maxRetries);
        // Replace delay with capture (no actual waiting)
        sut.DelayFunc = (delay, _) =>
        {
            _delays.Add(delay);
            return Task.CompletedTask;
        };
        return sut;
    }

    private static ChatResponse SuccessResponse()
        => new([new ChatMessage(ChatRole.Assistant, "OK")]);

    private static HttpRequestException TransientError(HttpStatusCode statusCode = HttpStatusCode.InternalServerError)
        => new("Transient error", null, statusCode);

    private static HttpRequestException RateLimitError(int? retryAfterSeconds = null)
    {
        var ex = new HttpRequestException("Rate limit exceeded", null, HttpStatusCode.TooManyRequests);
        if (retryAfterSeconds.HasValue)
            ex.Data["Retry-After"] = retryAfterSeconds.Value.ToString();
        return ex;
    }

    // ── Success on first attempt ──

    [Fact]
    public async Task GetResponseAsync_SucceedsOnFirstAttempt_ReturnsDirectly()
    {
        var sut = CreateSut();
        _innerClient.GetResponseAsync(Arg.Any<IEnumerable<ChatMessage>>(), Arg.Any<ChatOptions?>(), Arg.Any<CancellationToken>())
            .Returns(SuccessResponse());

        var result = await sut.GetResponseAsync([new ChatMessage(ChatRole.User, "hi")]);

        result.Messages.Should().HaveCount(1);
        _delays.Should().BeEmpty();
    }

    // ── Transient failure then success ──

    [Fact]
    public async Task GetResponseAsync_TransientFailureThenSuccess_Retries()
    {
        var sut = CreateSut();
        var callCount = 0;
        _innerClient.GetResponseAsync(Arg.Any<IEnumerable<ChatMessage>>(), Arg.Any<ChatOptions?>(), Arg.Any<CancellationToken>())
            .Returns(_ =>
            {
                callCount++;
                if (callCount == 1) throw TransientError();
                return SuccessResponse();
            });

        var result = await sut.GetResponseAsync([new ChatMessage(ChatRole.User, "hi")]);

        result.Messages.Should().HaveCount(1);
        callCount.Should().Be(2);
        _delays.Should().HaveCount(1);
    }

    // ── All retries exhausted ──

    [Fact]
    public async Task GetResponseAsync_AllRetriesExhausted_ThrowsAiProviderException()
    {
        var sut = CreateSut(maxRetries: 2);
        _innerClient.GetResponseAsync(Arg.Any<IEnumerable<ChatMessage>>(), Arg.Any<ChatOptions?>(), Arg.Any<CancellationToken>())
            .ThrowsAsync(TransientError());

        var act = () => sut.GetResponseAsync([new ChatMessage(ChatRole.User, "hi")]);

        var ex = await act.Should().ThrowAsync<AiProviderException>();
        ex.Which.AttemptsMade.Should().Be(3);
        ex.Which.Category.Should().Be(AiProviderErrorCategory.Unavailable);
        ex.Which.ProviderName.Should().Be("TestProvider");
        ex.Which.InnerException.Should().BeOfType<HttpRequestException>();
        _delays.Should().HaveCount(2); // 2 retries
    }

    // ── 429 with Retry-After header ──

    [Fact]
    public async Task GetResponseAsync_429WithRetryAfter_UsesSpecifiedDelay()
    {
        var sut = CreateSut(maxRetries: 1);
        var callCount = 0;
        _innerClient.GetResponseAsync(Arg.Any<IEnumerable<ChatMessage>>(), Arg.Any<ChatOptions?>(), Arg.Any<CancellationToken>())
            .Returns(_ =>
            {
                callCount++;
                if (callCount == 1) throw RateLimitError(retryAfterSeconds: 30);
                return SuccessResponse();
            });

        var result = await sut.GetResponseAsync([new ChatMessage(ChatRole.User, "hi")]);

        result.Messages.Should().HaveCount(1);
        _delays.Should().HaveCount(1);
        _delays[0].Should().Be(TimeSpan.FromSeconds(30));
    }

    // ── 429 without Retry-After falls back to exponential backoff ──

    [Fact]
    public async Task GetResponseAsync_429WithoutRetryAfter_UsesExponentialBackoff()
    {
        var sut = CreateSut(maxRetries: 1);
        var callCount = 0;
        _innerClient.GetResponseAsync(Arg.Any<IEnumerable<ChatMessage>>(), Arg.Any<ChatOptions?>(), Arg.Any<CancellationToken>())
            .Returns(_ =>
            {
                callCount++;
                if (callCount == 1) throw RateLimitError(retryAfterSeconds: null);
                return SuccessResponse();
            });

        await sut.GetResponseAsync([new ChatMessage(ChatRole.User, "hi")]);

        _delays.Should().HaveCount(1);
        // First attempt backoff: ~1s ±25% → 0.75s to 1.25s
        _delays[0].TotalSeconds.Should().BeInRange(0.75, 1.25);
    }

    // ── Non-transient error throws immediately ──

    [Fact]
    public async Task GetResponseAsync_NonTransientError_ThrowsImmediately()
    {
        var sut = CreateSut();
        _innerClient.GetResponseAsync(Arg.Any<IEnumerable<ChatMessage>>(), Arg.Any<ChatOptions?>(), Arg.Any<CancellationToken>())
            .ThrowsAsync(new HttpRequestException("Bad request", null, HttpStatusCode.BadRequest));

        var act = () => sut.GetResponseAsync([new ChatMessage(ChatRole.User, "hi")]);

        await act.Should().ThrowAsync<HttpRequestException>();
        _delays.Should().BeEmpty();
    }

    // ── OperationCanceledException rethrows without retry ──

    [Fact]
    public async Task GetResponseAsync_OperationCancelled_RethrowsWithoutRetry()
    {
        var sut = CreateSut();
        var cts = new CancellationTokenSource();
        cts.Cancel();
        _innerClient.GetResponseAsync(Arg.Any<IEnumerable<ChatMessage>>(), Arg.Any<ChatOptions?>(), Arg.Any<CancellationToken>())
            .ThrowsAsync(new OperationCanceledException());

        var act = () => sut.GetResponseAsync([new ChatMessage(ChatRole.User, "hi")], cancellationToken: cts.Token);

        await act.Should().ThrowAsync<OperationCanceledException>();
        _delays.Should().BeEmpty();
    }

    // ── Error category classification ──

    [Fact]
    public async Task GetResponseAsync_429Exhausted_CategoryIsRateLimited()
    {
        var sut = CreateSut(maxRetries: 1);
        _innerClient.GetResponseAsync(Arg.Any<IEnumerable<ChatMessage>>(), Arg.Any<ChatOptions?>(), Arg.Any<CancellationToken>())
            .ThrowsAsync(RateLimitError(retryAfterSeconds: 30));

        var act = () => sut.GetResponseAsync([new ChatMessage(ChatRole.User, "hi")]);

        var ex = await act.Should().ThrowAsync<AiProviderException>();
        ex.Which.Category.Should().Be(AiProviderErrorCategory.RateLimited);
        ex.Which.RetryAfterSeconds.Should().Be(30);
    }

    [Fact]
    public async Task GetResponseAsync_TimeoutExhausted_CategoryIsTimeout()
    {
        var sut = CreateSut(maxRetries: 1);
        _innerClient.GetResponseAsync(Arg.Any<IEnumerable<ChatMessage>>(), Arg.Any<ChatOptions?>(), Arg.Any<CancellationToken>())
            .ThrowsAsync(new TimeoutException("Timed out"));

        var act = () => sut.GetResponseAsync([new ChatMessage(ChatRole.User, "hi")]);

        var ex = await act.Should().ThrowAsync<AiProviderException>();
        ex.Which.Category.Should().Be(AiProviderErrorCategory.Timeout);
    }

    [Fact]
    public async Task GetResponseAsync_5xxExhausted_CategoryIsUnavailable()
    {
        var sut = CreateSut(maxRetries: 1);
        _innerClient.GetResponseAsync(Arg.Any<IEnumerable<ChatMessage>>(), Arg.Any<ChatOptions?>(), Arg.Any<CancellationToken>())
            .ThrowsAsync(TransientError(HttpStatusCode.ServiceUnavailable));

        var act = () => sut.GetResponseAsync([new ChatMessage(ChatRole.User, "hi")]);

        var ex = await act.Should().ThrowAsync<AiProviderException>();
        ex.Which.Category.Should().Be(AiProviderErrorCategory.Unavailable);
    }

    // ── ProviderName propagation ──

    [Fact]
    public async Task GetResponseAsync_Exhausted_ProviderNamePropagated()
    {
        var sut = new ResilientChatClient(_innerClient, "MyCustomProvider", _logger, maxRetries: 1);
        sut.DelayFunc = (_, _) => Task.CompletedTask;
        _innerClient.GetResponseAsync(Arg.Any<IEnumerable<ChatMessage>>(), Arg.Any<ChatOptions?>(), Arg.Any<CancellationToken>())
            .ThrowsAsync(TransientError());

        var act = () => sut.GetResponseAsync([new ChatMessage(ChatRole.User, "hi")]);

        var ex = await act.Should().ThrowAsync<AiProviderException>();
        ex.Which.ProviderName.Should().Be("MyCustomProvider");
    }

    // ── Streaming path ──

    [Fact]
    public async Task GetStreamingResponseAsync_TransientFailureThenSuccess_Retries()
    {
        var sut = CreateSut();
        var callCount = 0;
        _innerClient.GetStreamingResponseAsync(Arg.Any<IEnumerable<ChatMessage>>(), Arg.Any<ChatOptions?>(), Arg.Any<CancellationToken>())
            .Returns(_ =>
            {
                callCount++;
                if (callCount == 1) throw TransientError();
                return AsyncEnumerable([new ChatResponseUpdate(ChatRole.Assistant, "OK")]);
            });

        var updates = new List<ChatResponseUpdate>();
        await foreach (var update in sut.GetStreamingResponseAsync([new ChatMessage(ChatRole.User, "hi")]))
        {
            updates.Add(update);
        }

        updates.Should().HaveCount(1);
        callCount.Should().Be(2);
        _delays.Should().HaveCount(1);
    }

    [Fact]
    public async Task GetStreamingResponseAsync_AllRetriesExhausted_ThrowsAiProviderException()
    {
        var sut = CreateSut(maxRetries: 1);
        _innerClient.GetStreamingResponseAsync(Arg.Any<IEnumerable<ChatMessage>>(), Arg.Any<ChatOptions?>(), Arg.Any<CancellationToken>())
            .Returns<IAsyncEnumerable<ChatResponseUpdate>>(_ => throw TransientError());

        var act = async () =>
        {
            await foreach (var _ in sut.GetStreamingResponseAsync([new ChatMessage(ChatRole.User, "hi")]))
            { }
        };

        await act.Should().ThrowAsync<AiProviderException>();
    }

    // ── IsTransient classification ──

    [Theory]
    [InlineData(HttpStatusCode.TooManyRequests, true)]
    [InlineData(HttpStatusCode.InternalServerError, true)]
    [InlineData(HttpStatusCode.BadGateway, true)]
    [InlineData(HttpStatusCode.ServiceUnavailable, true)]
    [InlineData(HttpStatusCode.GatewayTimeout, true)]
    [InlineData(HttpStatusCode.BadRequest, false)]
    [InlineData(HttpStatusCode.Unauthorized, false)]
    [InlineData(HttpStatusCode.Forbidden, false)]
    [InlineData(HttpStatusCode.NotFound, false)]
    public void IsTransient_HttpRequestException_ClassifiesCorrectly(HttpStatusCode statusCode, bool expected)
    {
        var ex = new HttpRequestException("test", null, statusCode);
        ResilientChatClient.IsTransient(ex).Should().Be(expected);
    }

    [Fact]
    public void IsTransient_TimeoutException_ReturnsTrue()
    {
        ResilientChatClient.IsTransient(new TimeoutException()).Should().BeTrue();
    }

    [Fact]
    public void IsTransient_TaskCanceledException_ReturnsFalse()
    {
        ResilientChatClient.IsTransient(new TaskCanceledException()).Should().BeFalse();
    }

    [Fact]
    public void IsTransient_GenericException_ReturnsFalse()
    {
        ResilientChatClient.IsTransient(new InvalidOperationException()).Should().BeFalse();
    }

    // ── Exponential backoff timing ──

    [Fact]
    public async Task GetResponseAsync_MultipleRetries_BackoffIncreasesExponentially()
    {
        var sut = CreateSut(maxRetries: 3);
        var callCount = 0;
        _innerClient.GetResponseAsync(Arg.Any<IEnumerable<ChatMessage>>(), Arg.Any<ChatOptions?>(), Arg.Any<CancellationToken>())
            .Returns(_ =>
            {
                callCount++;
                if (callCount <= 3) throw TransientError();
                return SuccessResponse();
            });

        await sut.GetResponseAsync([new ChatMessage(ChatRole.User, "hi")]);

        _delays.Should().HaveCount(3);
        // Attempt 1: ~1s ±25%, Attempt 2: ~2s ±25%, Attempt 3: ~4s ±25%
        _delays[0].TotalSeconds.Should().BeInRange(0.75, 1.25);
        _delays[1].TotalSeconds.Should().BeInRange(1.50, 2.50);
        _delays[2].TotalSeconds.Should().BeInRange(3.00, 5.00);
    }

    // ── Helper to create async enumerable from items ──

    private static async IAsyncEnumerable<T> AsyncEnumerable<T>(IEnumerable<T> items)
    {
        foreach (var item in items)
        {
            yield return item;
        }
        await Task.CompletedTask;
    }
}
