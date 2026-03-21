using System.Text;
using Clarive.Auth.Google;
using Clarive.Auth.Jwt;
using Clarive.Domain.Interfaces.Services;
using Microsoft.AspNetCore.Authentication;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.IdentityModel.Tokens;
using Serilog;

namespace Clarive.Auth;

public static class DependencyInjection
{
    public static IServiceCollection AddClariveAuth(
        this IServiceCollection services,
        IConfiguration configuration)
    {
        // ── JWT Settings ──
        services.Configure<JwtSettings>(configuration.GetSection("Jwt"));
        var jwtSettings = configuration.GetSection("Jwt").Get<JwtSettings>()!;

        if (string.IsNullOrWhiteSpace(jwtSettings.Secret))
            throw new InvalidOperationException(
                "Jwt:Secret is not configured. "
                    + "Set it in appsettings.Development.json or the JWT__SECRET environment variable."
            );

        if (Encoding.UTF8.GetByteCount(jwtSettings.Secret) < 32)
            throw new InvalidOperationException(
                "Jwt:Secret must be at least 32 bytes (256 bits) for HMAC-SHA256. "
                    + "Current key is too short."
            );

        // ── Authentication ──
        services
            .AddAuthentication(JwtBearerDefaults.AuthenticationScheme)
            .AddJwtBearer(options =>
            {
                options.TokenValidationParameters = new TokenValidationParameters
                {
                    ValidateIssuer = true,
                    ValidIssuer = jwtSettings.Issuer,
                    ValidateAudience = true,
                    ValidAudience = jwtSettings.Audience,
                    ValidateIssuerSigningKey = true,
                    IssuerSigningKey = new SymmetricSecurityKey(
                        Encoding.UTF8.GetBytes(jwtSettings.Secret)
                    ),
                    ValidateLifetime = true,
                    ClockSkew = TimeSpan.FromMinutes(1),
                };

                // SignalR: browsers can't send Authorization headers with WebSocket connections,
                // so the client sends the JWT as a query string parameter instead.
                options.Events = new JwtBearerEvents
                {
                    OnMessageReceived = context =>
                    {
                        var accessToken = context.Request.Query["access_token"];
                        var path = context.HttpContext.Request.Path;
                        if (!string.IsNullOrEmpty(accessToken)
                            && path.StartsWithSegments("/api/hubs"))
                        {
                            context.Token = accessToken;
                        }
                        return Task.CompletedTask;
                    }
                };
            })
            .AddScheme<AuthenticationSchemeOptions, ApiKeyAuthHandler>(
                ApiKeyAuthHandler.SchemeName,
                _ => { }
            );

        services.AddSingleton<JwtService>();

        // ── Google OAuth ──
        services.Configure<GoogleAuthSettings>(configuration.GetSection("Google"));
        var googleSettings =
            configuration.GetSection("Google").Get<GoogleAuthSettings>()
            ?? new GoogleAuthSettings();
        if (!string.IsNullOrWhiteSpace(googleSettings.ClientId))
        {
            services.AddSingleton<IGoogleAuthService, GoogleAuthService>();
        }
        else
        {
            services.AddSingleton<IGoogleAuthService, NullGoogleAuthService>();
            Log.Warning("Google OAuth disabled: Google:ClientId not configured");
        }

        return services;
    }
}
