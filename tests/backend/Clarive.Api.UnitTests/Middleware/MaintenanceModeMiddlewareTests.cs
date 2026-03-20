using Clarive.Api.Middleware;
using FluentAssertions;
using Microsoft.AspNetCore.Http;
using Microsoft.Extensions.Logging.Abstractions;
using NSubstitute;

namespace Clarive.Api.UnitTests.Middleware;

public class MaintenanceModeMiddlewareTests
{
    private static MaintenanceModeMiddleware CreateMiddleware(
        IMaintenanceModeService maintenanceMode,
        RequestDelegate? next = null
    )
    {
        return new MaintenanceModeMiddleware(
            next ?? (_ => Task.CompletedTask),
            maintenanceMode,
            NullLogger<MaintenanceModeMiddleware>.Instance
        );
    }

    private static IMaintenanceModeService MockMaintenance(bool enabled)
    {
        var mock = Substitute.For<IMaintenanceModeService>();
        mock.IsEnabled.Returns(enabled);
        return mock;
    }

    [Fact]
    public async Task InvokeAsync_MaintenanceDisabled_CallsNext()
    {
        var nextCalled = false;
        var middleware = CreateMiddleware(
            MockMaintenance(false),
            _ =>
            {
                nextCalled = true;
                return Task.CompletedTask;
            }
        );

        var context = new DefaultHttpContext();
        context.Request.Path = "/api/entries";

        await middleware.InvokeAsync(context);

        nextCalled.Should().BeTrue();
    }

    [Fact]
    public async Task InvokeAsync_MaintenanceEnabled_BlocksRegularPath()
    {
        var middleware = CreateMiddleware(MockMaintenance(true));

        var context = new DefaultHttpContext();
        context.Request.Path = "/api/entries";

        await middleware.InvokeAsync(context);

        context.Response.StatusCode.Should().Be(503);
        context.Response.Headers["Retry-After"].ToString().Should().Be("60");
    }

    [Theory]
    [InlineData("/api/auth/login")]
    [InlineData("/api/auth/refresh")]
    [InlineData("/api/auth/google")]
    [InlineData("/api/status")]
    public async Task InvokeAsync_MaintenanceEnabled_AllowsExemptExactPaths(string path)
    {
        var nextCalled = false;
        var middleware = CreateMiddleware(
            MockMaintenance(true),
            _ =>
            {
                nextCalled = true;
                return Task.CompletedTask;
            }
        );

        var context = new DefaultHttpContext();
        context.Request.Path = path;

        await middleware.InvokeAsync(context);

        nextCalled.Should().BeTrue();
        context.Response.StatusCode.Should().NotBe(503);
    }

    [Theory]
    [InlineData("/healthz")]
    [InlineData("/healthz/ready")]
    [InlineData("/api/super")]
    [InlineData("/api/super/stats")]
    [InlineData("/api/super/config/key")]
    public async Task InvokeAsync_MaintenanceEnabled_AllowsExemptPrefixPaths(string path)
    {
        var nextCalled = false;
        var middleware = CreateMiddleware(
            MockMaintenance(true),
            _ =>
            {
                nextCalled = true;
                return Task.CompletedTask;
            }
        );

        var context = new DefaultHttpContext();
        context.Request.Path = path;

        await middleware.InvokeAsync(context);

        nextCalled.Should().BeTrue();
    }

    [Theory]
    [InlineData("/api/entries")]
    [InlineData("/api/folders")]
    [InlineData("/api/auth/register")]
    [InlineData("/api/dashboard/stats")]
    public async Task InvokeAsync_MaintenanceEnabled_BlocksNonExemptPaths(string path)
    {
        var middleware = CreateMiddleware(MockMaintenance(true));

        var context = new DefaultHttpContext();
        context.Request.Path = path;

        await middleware.InvokeAsync(context);

        context.Response.StatusCode.Should().Be(503);
    }

    [Fact]
    public async Task InvokeAsync_MaintenanceEnabled_SuperUserToken_Allowed()
    {
        var nextCalled = false;
        var middleware = CreateMiddleware(
            MockMaintenance(true),
            _ =>
            {
                nextCalled = true;
                return Task.CompletedTask;
            }
        );

        // Create a minimal JWT with superUser claim
        // Header: {"alg":"none","typ":"JWT"}
        // Payload: {"superUser":"true"}
        var header = Convert
            .ToBase64String("{ \"alg\": \"none\", \"typ\": \"JWT\" }"u8)
            .TrimEnd('=');
        var payload = Convert.ToBase64String("{ \"superUser\": \"true\" }"u8).TrimEnd('=');
        var fakeJwt = $"{header}.{payload}.";

        var context = new DefaultHttpContext();
        context.Request.Path = "/api/entries";
        context.Request.Headers.Authorization = $"Bearer {fakeJwt}";

        await middleware.InvokeAsync(context);

        nextCalled.Should().BeTrue();
        context.Response.Headers["X-Maintenance-Mode"].ToString().Should().Be("true");
    }

    [Fact]
    public async Task InvokeAsync_MaintenanceEnabled_NonSuperUserToken_Blocked()
    {
        var middleware = CreateMiddleware(MockMaintenance(true));

        var header = Convert
            .ToBase64String("{ \"alg\": \"none\", \"typ\": \"JWT\" }"u8)
            .TrimEnd('=');
        var payload = Convert.ToBase64String("{ \"sub\": \"user123\" }"u8).TrimEnd('=');
        var fakeJwt = $"{header}.{payload}.";

        var context = new DefaultHttpContext();
        context.Request.Path = "/api/entries";
        context.Request.Headers.Authorization = $"Bearer {fakeJwt}";

        await middleware.InvokeAsync(context);

        context.Response.StatusCode.Should().Be(503);
    }

    [Fact]
    public async Task InvokeAsync_MaintenanceEnabled_InvalidToken_Blocked()
    {
        var middleware = CreateMiddleware(MockMaintenance(true));

        var context = new DefaultHttpContext();
        context.Request.Path = "/api/entries";
        context.Request.Headers.Authorization = "Bearer not-a-valid-jwt";

        await middleware.InvokeAsync(context);

        context.Response.StatusCode.Should().Be(503);
    }
}
