using System.Text.Json;
using Clarive.Api.Middleware;
using FluentAssertions;
using Microsoft.AspNetCore.Http;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;
using NSubstitute;

namespace Clarive.Api.UnitTests.Middleware;

public class ErrorHandlingMiddlewareTests
{
    private static (ErrorHandlingMiddleware Middleware, DefaultHttpContext Context) CreateSetup(
        RequestDelegate next,
        bool isDevelopment = false
    )
    {
        var logger = Substitute.For<ILogger<ErrorHandlingMiddleware>>();
        var middleware = new ErrorHandlingMiddleware(next, logger);

        var context = new DefaultHttpContext();
        context.Response.Body = new MemoryStream();

        var env = Substitute.For<IHostEnvironment>();
        env.EnvironmentName.Returns(isDevelopment ? "Development" : "Production");

        var services = new ServiceCollection();
        services.AddSingleton(env);
        context.RequestServices = services.BuildServiceProvider();

        return (middleware, context);
    }

    private static async Task<JsonElement> ReadResponseJson(HttpContext context)
    {
        context.Response.Body.Seek(0, SeekOrigin.Begin);
        return await JsonSerializer.DeserializeAsync<JsonElement>(context.Response.Body);
    }

    [Fact]
    public async Task InvokeAsync_NoException_PassesThrough()
    {
        var nextCalled = false;
        var (middleware, context) = CreateSetup(_ =>
        {
            nextCalled = true;
            return Task.CompletedTask;
        });

        await middleware.InvokeAsync(context);

        nextCalled.Should().BeTrue();
        context.Response.StatusCode.Should().Be(200);
    }

    [Fact]
    public async Task InvokeAsync_GenericException_Returns500()
    {
        var (middleware, context) = CreateSetup(_ =>
            throw new InvalidOperationException("Something broke")
        );

        await middleware.InvokeAsync(context);

        context.Response.StatusCode.Should().Be(500);
        context.Response.ContentType.Should().Contain("application/json");
    }

    [Fact]
    public async Task InvokeAsync_GenericException_Production_HidesDetails()
    {
        var (middleware, context) = CreateSetup(
            _ => throw new InvalidOperationException("Secret internal error"),
            isDevelopment: false
        );

        await middleware.InvokeAsync(context);

        var json = await ReadResponseJson(context);
        var message = json.GetProperty("error").GetProperty("message").GetString();
        message.Should().Be("An unexpected error occurred.");
        message.Should().NotContain("Secret internal error");
    }

    [Fact]
    public async Task InvokeAsync_GenericException_Development_ShowsDetails()
    {
        var (middleware, context) = CreateSetup(
            _ => throw new InvalidOperationException("Detailed error info"),
            isDevelopment: true
        );

        await middleware.InvokeAsync(context);

        var json = await ReadResponseJson(context);
        var message = json.GetProperty("error").GetProperty("message").GetString();
        message.Should().Contain("Detailed error info");
    }

    [Fact]
    public async Task InvokeAsync_DbUpdateConcurrencyException_Returns409()
    {
        var (middleware, context) = CreateSetup(_ =>
            throw new DbUpdateConcurrencyException("Conflict")
        );

        await middleware.InvokeAsync(context);

        context.Response.StatusCode.Should().Be(409);
        var json = await ReadResponseJson(context);
        json.GetProperty("error")
            .GetProperty("code")
            .GetString()
            .Should()
            .Be("CONCURRENCY_CONFLICT");
    }

    [Fact]
    public async Task InvokeAsync_OperationCanceled_ClientDisconnect_DoesNotReturn500()
    {
        var cts = new CancellationTokenSource();
        cts.Cancel();

        var (middleware, context) = CreateSetup(_ => throw new OperationCanceledException());
        context.RequestAborted = cts.Token;

        await middleware.InvokeAsync(context);

        // Should not set 500 — client disconnected
        context.Response.StatusCode.Should().NotBe(500);
    }
}
