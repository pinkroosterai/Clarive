using Clarive.Auth.Jwt;
using Clarive.Auth;
using Clarive.AI;
using Clarive.Domain.Interfaces.Services;
using Clarive.AI.Agents;
using Clarive.AI.Services;
using Clarive.Infrastructure.Security;
using Clarive.Infrastructure;
using System.Text;
using Clarive.Domain.Interfaces;
using System.Text.Json;
using System.Text.Json.Serialization;
using System.Threading.RateLimiting;
using Clarive.Api.Auth;
using Clarive.Api.Configuration;
using Clarive.Infrastructure.Data;
using Clarive.Api.Endpoints;
using Clarive.Api.HealthChecks;
using Clarive.Api.Middleware;
using Clarive.Infrastructure.Repositories;
using Clarive.Domain.Interfaces.Repositories;
using Clarive.Api.Seed;
using Clarive.Api.Services;
using Clarive.Api.Services.Interfaces;
using Microsoft.AspNetCore.Authentication;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.AspNetCore.HttpOverrides;
using Microsoft.AspNetCore.RateLimiting;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Diagnostics.HealthChecks;
using Microsoft.Extensions.Options;
using Microsoft.IdentityModel.Tokens;
using Microsoft.OpenApi;
using Npgsql;
using Resend;
using Serilog;

// ── Serilog Bootstrap (catches startup errors) ──
Log.Logger = new LoggerConfiguration().WriteTo.Console().CreateBootstrapLogger();

try
{
    var builder = WebApplication.CreateBuilder(args);

    // ── Serilog ──
    builder.Services.AddSerilog(
        (services, lc) =>
        {
            lc.ReadFrom.Configuration(builder.Configuration)
                .ReadFrom.Services(services)
                .Enrich.FromLogContext()
                .Enrich.WithMachineName()
                .Enrich.WithThreadId();

            // PostgreSQL sink — connection string comes from env vars, so configure programmatically
            var pgConn = builder.Configuration.GetConnectionString("DefaultConnection");
            if (!string.IsNullOrWhiteSpace(pgConn))
            {
                var columnWriters = new Dictionary<
                    string,
                    Serilog.Sinks.PostgreSQL.ColumnWriters.ColumnWriterBase
                >
                {
                    {
                        "id",
                        new Serilog.Sinks.PostgreSQL.ColumnWriters.IdAutoIncrementColumnWriter()
                    },
                    {
                        "timestamp",
                        new Serilog.Sinks.PostgreSQL.ColumnWriters.TimestampColumnWriter()
                    },
                    {
                        "level",
                        new Serilog.Sinks.PostgreSQL.ColumnWriters.LevelColumnWriter(
                            renderAsText: false
                        )
                    },
                    {
                        "message",
                        new Serilog.Sinks.PostgreSQL.ColumnWriters.RenderedMessageColumnWriter()
                    },
                    {
                        "message_template",
                        new Serilog.Sinks.PostgreSQL.ColumnWriters.MessageTemplateColumnWriter()
                    },
                    {
                        "exception",
                        new Serilog.Sinks.PostgreSQL.ColumnWriters.ExceptionColumnWriter()
                    },
                    {
                        "properties",
                        new Serilog.Sinks.PostgreSQL.ColumnWriters.PropertiesColumnWriter()
                    },
                };

                lc.WriteTo.PostgreSQL(
                    connectionString: pgConn,
                    tableName: "logs",
                    columnOptions: columnWriters,
                    needAutoCreateTable: true,
                    batchSizeLimit: 50,
                    period: TimeSpan.FromSeconds(5),
                    useCopy: true
                );
            }
        }
    );

    // ── Validate required configuration ──
    var connectionString = builder.Configuration.GetConnectionString("DefaultConnection");
    if (string.IsNullOrWhiteSpace(connectionString))
        throw new InvalidOperationException(
            "ConnectionStrings:DefaultConnection is not configured. "
                + "Set it in appsettings.Development.json or the CONNECTIONSTRINGS__DEFAULTCONNECTION environment variable."
        );

    // ── Infrastructure (DbContext, repos, email, cache, security, bg jobs) ──
    builder.Services.AddClariveInfrastructure(builder.Configuration);

    // ── Database Configuration Override (highest priority, overrides env vars) ──
    builder.Configuration.AddDatabaseConfiguration(
        connectionString,
        builder.Configuration["CONFIG_ENCRYPTION_KEY"]
    );

    // ── Authentication (JWT, API key, Google OAuth) ──
    builder.Services.AddClariveAuth(builder.Configuration);

    // ── Authorization ──
    builder
        .Services.AddAuthorizationBuilder()
        .AddPolicy("AdminOnly", p => p.RequireRole("admin"))
        .AddPolicy("EditorOrAdmin", p => p.RequireRole("admin", "editor"))
        .AddPolicy("SuperUser", p => p.RequireClaim("superUser", "true"));

    // ── CORS ──
    var corsOrigins =
        builder.Configuration.GetSection("Cors:AllowedOrigins").Get<string[]>()
        ?? ["http://localhost:8080"];
    builder.Services.AddCors(options =>
    {
        options.AddPolicy(
            "AppCors",
            policy =>
            {
                if (builder.Environment.IsDevelopment())
                    policy.SetIsOriginAllowed(_ => true);
                else
                    policy.WithOrigins(corsOrigins);

                policy.AllowAnyHeader().AllowAnyMethod().AllowCredentials();
            }
        );
    });

    // ── Swagger (Swashbuckle v10 API) ──
    if (builder.Environment.IsDevelopment())
    {
        builder.Services.AddEndpointsApiExplorer();
        builder.Services.AddSwaggerGen(options =>
        {
            options.SwaggerDoc(
                "v1",
                new OpenApiInfo
                {
                    Title = "Clarive API",
                    Version = "v1",
                    Description = "REST API for the Clarive prompt management platform.",
                }
            );
            options.AddSecurityDefinition(
                "bearer",
                new OpenApiSecurityScheme
                {
                    Type = SecuritySchemeType.Http,
                    Scheme = "bearer",
                    BearerFormat = "JWT",
                    Description = "JWT Authorization header using the Bearer scheme.",
                }
            );
            options.AddSecurityDefinition(
                "apiKey",
                new OpenApiSecurityScheme
                {
                    Type = SecuritySchemeType.ApiKey,
                    In = ParameterLocation.Header,
                    Name = "X-Api-Key",
                    Description = "API key for public endpoint access.",
                }
            );
            options.AddSecurityRequirement(document => new OpenApiSecurityRequirement
            {
                [new OpenApiSecuritySchemeReference("bearer", document)] = [],
            });
        });
    }

    // ── JSON Serialization ──
    builder.Services.ConfigureHttpJsonOptions(options =>
    {
        options.SerializerOptions.PropertyNamingPolicy = JsonNamingPolicy.CamelCase;
        options.SerializerOptions.Converters.Add(
            new JsonStringEnumConverter(JsonNamingPolicy.SnakeCaseLower)
        );
        options.SerializerOptions.DefaultIgnoreCondition = JsonIgnoreCondition.WhenWritingNull;
    });

    // ── Tenant isolation ──
    builder.Services.AddHttpContextAccessor();
    builder.Services.AddScoped<ITenantProvider, HttpContextTenantProvider>();

    // (Database, Caching, Repositories registered via AddClariveInfrastructure above)

    // ── Services ──
    builder.Services.AddSingleton<MaintenanceModeService>();
    builder.Services.AddSingleton<IMaintenanceModeService>(sp =>
        sp.GetRequiredService<MaintenanceModeService>()
    );
    // (JwtService registered via AddClariveAuth)
    // (PasswordHasher, EncryptionService registered via AddClariveInfrastructure)
    builder.Services.AddScoped<IAuditLogger, AuditLogger>();
    builder.Services.AddScoped<IEntryService, EntryService>();
    builder.Services.AddScoped<IAccountService, AccountService>();
    builder.Services.AddScoped<IInvitationService, InvitationService>();
    builder.Services.AddScoped<IAiGenerationService, AiGenerationService>();
    builder.Services.AddScoped<IUserManagementService, UserManagementService>();
    builder.Services.AddScoped<IAuthService, AuthService>();
    builder.Services.AddScoped<IProfileService, ProfileService>();
    builder.Services.AddScoped<IImportExportService, ImportExportService>();
    builder.Services.AddScoped<IFolderService, FolderService>();
    builder.Services.AddScoped<IModelResolutionService, ModelResolutionService>();
    builder.Services.AddScoped<IPlaygroundRunService, PlaygroundRunService>();
    builder.Services.AddScoped<ISuperAdminService, SuperAdminService>();
    builder.Services.AddScoped<IPlaygroundService, PlaygroundService>();
    builder.Services.AddScoped<IAiProviderService, AiProviderService>();
    builder.Services.AddScoped<IAiUsageLogger, AiUsageLogger>();
    builder.Services.AddScoped<IShareLinkService, ShareLinkService>();
    builder.Services.Configure<AvatarSettings>(builder.Configuration.GetSection("Avatar"));
    builder.Services.AddScoped<IAvatarService, AvatarService>();
    // (Email registered via AddClariveInfrastructure)
    builder.Services.AddScoped<IOnboardingSeeder, OnboardingSeeder>();

    // ── Settings ──
    builder.Services.Configure<AppSettings>(builder.Configuration.GetSection("App"));
    // (EmailSettings configured via AddClariveInfrastructure)

    // (Google OAuth registered via AddClariveAuth)

    // ── AI Configuration (Agent-based) ──
    builder.Services.AddClariveAI(builder.Configuration);
    builder.Services.AddScoped<IMcpImportService, McpImportService>();
    builder.Services.AddSingleton<ITavilyClientService, TavilyClientService>();
    builder.Services.AddSingleton<ILiteLlmRegistryCache, LiteLlmRegistryCache>();

    // ── Background Services (remaining in Api due to app-layer dependencies) ──
    builder.Services.AddHostedService<Clarive.Api.Services.Background.AccountPurgeBackgroundService>();
    builder.Services.AddHostedService<Clarive.Api.Services.Background.MaintenanceModeSyncService>();
    builder.Services.AddHostedService<Clarive.Api.Services.Background.LiteLlmSyncService>();
    // (TokenCleanup, AiSessionCleanup, AiUsageCleanup, LogCleanup registered via AddClariveInfrastructure)

    // ── Rate Limiting ──
    builder.Services.AddRateLimiter(options =>
    {
        options.RejectionStatusCode = StatusCodes.Status429TooManyRequests;
        options.OnRejected = async (context, cancellationToken) =>
        {
            var http = context.HttpContext;
            var logger = http
                .RequestServices.GetRequiredService<ILoggerFactory>()
                .CreateLogger("RateLimiter");
            logger.LogWarning(
                "Rate limit exceeded for {ClientIp} on {Method} {Path}",
                http.Connection.RemoteIpAddress?.ToString() ?? "unknown",
                http.Request.Method,
                http.Request.Path
            );

            http.Response.StatusCode = StatusCodes.Status429TooManyRequests;
            await http.Response.WriteAsJsonAsync(
                new { error = new { code = "RATE_LIMITED", message = "Too many requests." } },
                cancellationToken
            );
        };
        options.AddPolicy(
            "auth",
            httpContext =>
            {
                var permitLimit = httpContext
                    .RequestServices.GetRequiredService<IConfiguration>()
                    .GetValue("RateLimiting:PermitLimit", 20);
                return RateLimitPartition.GetFixedWindowLimiter(
                    partitionKey: httpContext.Connection.RemoteIpAddress?.ToString() ?? "unknown",
                    factory: _ => new FixedWindowRateLimiterOptions
                    {
                        PermitLimit = permitLimit,
                        Window = TimeSpan.FromMinutes(1),
                        QueueLimit = 0,
                    }
                );
            }
        );
        options.AddPolicy(
            "strict-auth",
            httpContext =>
            {
                var strictLimit = httpContext
                    .RequestServices.GetRequiredService<IConfiguration>()
                    .GetValue("RateLimiting:StrictPermitLimit", 5);
                return RateLimitPartition.GetFixedWindowLimiter(
                    partitionKey: httpContext.Connection.RemoteIpAddress?.ToString() ?? "unknown",
                    factory: _ => new FixedWindowRateLimiterOptions
                    {
                        PermitLimit = strictLimit,
                        Window = TimeSpan.FromMinutes(15),
                        QueueLimit = 0,
                    }
                );
            }
        );
    });

    // ── Health Checks ──
    builder
        .Services.AddHealthChecks()
        .AddNpgSql(
            sp => sp.GetRequiredService<IConfiguration>().GetConnectionString("DefaultConnection")!,
            name: "postgresql",
            tags: ["ready"]
        )
        .AddCheck<OpenAiHealthCheck>(
            name: "openai",
            failureStatus: HealthStatus.Degraded,
            tags: ["ready"]
        )
        .AddCheck<ValkeyHealthCheck>(
            name: "valkey",
            failureStatus: HealthStatus.Degraded,
            tags: ["ready"]
        );

    var app = builder.Build();

    // ── Middleware ──
    app.UseForwardedHeaders(
        new ForwardedHeadersOptions
        {
            ForwardedHeaders = ForwardedHeaders.XForwardedFor | ForwardedHeaders.XForwardedProto,
        }
    );
    app.UseMiddleware<SecurityHeadersMiddleware>();
    app.UseMiddleware<ErrorHandlingMiddleware>();
    app.UseMiddleware<MaintenanceModeMiddleware>();
    app.UseSerilogRequestLogging(options =>
    {
        options.GetLevel = (httpContext, elapsed, ex) =>
        {
            // Suppress health check noise — these fire every 15s from Docker and flood the logs
            if (httpContext.Request.Path.StartsWithSegments("/healthz"))
                return Serilog.Events.LogEventLevel.Verbose;

            if (ex is not null || httpContext.Response.StatusCode >= 500)
                return Serilog.Events.LogEventLevel.Error;
            var sc = httpContext.Response.StatusCode;
            if (sc is 401 or 403 or 404 or 409 or 422 or 429)
                return Serilog.Events.LogEventLevel.Warning;
            return Serilog.Events.LogEventLevel.Information;
        };
        options.EnrichDiagnosticContext = (diagnosticContext, httpContext) =>
        {
            // Client identity
            diagnosticContext.Set(
                "ClientIp",
                httpContext.Connection.RemoteIpAddress?.ToString() ?? "unknown"
            );

            // Auth scheme attempted (useful for debugging auth failures)
            string authScheme = "anonymous";
            if (httpContext.Request.Headers.ContainsKey("Authorization"))
                authScheme = "jwt";
            else if (httpContext.Request.Headers.ContainsKey("X-Api-Key"))
                authScheme = "apikey";
            diagnosticContext.Set("AuthScheme", authScheme);

            var user = httpContext.User;
            if (user.Identity?.IsAuthenticated == true)
            {
                diagnosticContext.Set("TenantId", user.FindFirst("tenantId")?.Value ?? "");
                var userId = user.FindFirst(
                    System.Security.Claims.ClaimTypes.NameIdentifier
                )?.Value;
                if (userId is not null)
                {
                    diagnosticContext.Set("UserId", userId);
                    diagnosticContext.Set(
                        "UserRole",
                        user.FindFirst(System.Security.Claims.ClaimTypes.Role)?.Value ?? ""
                    );
                }
                else
                {
                    // API key auth — use apiKeyId/apiKeyName instead
                    diagnosticContext.Set("ApiKeyId", user.FindFirst("apiKeyId")?.Value ?? "");
                    diagnosticContext.Set("ApiKeyName", user.FindFirst("apiKeyName")?.Value ?? "");
                }
            }

            // Error context set by endpoint handlers via ctx.ErrorResult()
            if (httpContext.Items.TryGetValue("log:ErrorCode", out var errorCode))
                diagnosticContext.Set("ErrorCode", errorCode);
            if (httpContext.Items.TryGetValue("log:EntityType", out var entityType))
                diagnosticContext.Set("EntityType", entityType);
            if (httpContext.Items.TryGetValue("log:EntityId", out var entityId))
                diagnosticContext.Set("EntityId", entityId);
        };
    });
    app.UseCors("AppCors");

    if (app.Environment.IsDevelopment())
    {
        app.UseSwagger();
        app.UseSwaggerUI();
    }
    else
    {
        app.UseHsts();
    }

    app.UseAuthentication();
    app.UseAuthorization();
    app.UseMiddleware<Clarive.Api.Middleware.PublicApiRateLimitMiddleware>();
    app.UseRateLimiter();

    // ── Health Checks ──
    app.MapHealthChecks(
            "/healthz/live",
            new Microsoft.AspNetCore.Diagnostics.HealthChecks.HealthCheckOptions
            {
                Predicate = _ => false,
                ResponseWriter = HealthCheckResponseWriter.WriteAsync,
            }
        )
        .AllowAnonymous()
        .DisableRateLimiting()
        .ExcludeFromDescription();

    app.MapHealthChecks(
            "/healthz/ready",
            new Microsoft.AspNetCore.Diagnostics.HealthChecks.HealthCheckOptions
            {
                Predicate = check => check.Tags.Contains("ready"),
                ResponseWriter = HealthCheckResponseWriter.WriteAsync,
            }
        )
        .AllowAnonymous()
        .DisableRateLimiting()
        .ExcludeFromDescription();

    // ── Endpoints ──
    app.MapAuthEndpoints();
    app.MapFolderEndpoints();
    app.MapEntryEndpoints();
    app.MapToolEndpoints();
    app.MapApiKeyEndpoints();
    app.MapUserEndpoints();
    app.MapInvitationEndpoints();
    app.MapTenantEndpoints();
    app.MapWorkspaceEndpoints();
    app.MapAuditLogEndpoints();
    app.MapPublicApiEndpoints();
    app.MapImportExportEndpoints();
    app.MapAiGenerationEndpoints();
    app.MapAccountEndpoints();
    app.MapProfileEndpoints();
    app.MapDashboardEndpoints();
    app.MapTagEndpoints();
    app.MapSuperEndpoints();
    app.MapConfigEndpoints();
    app.MapPlaygroundEndpoints();
    app.MapAiProviderEndpoints();
    app.MapAiUsageEndpoints();
    app.MapShareLinkEndpoints();
    app.MapPublicShareEndpoints();
    app.MapSystemLogEndpoints();

    app.MapGet(
            "/api/status",
            (
                IMaintenanceModeService maintenanceMode,
                IAgentFactory agentFactory,
                ITavilyClientService tavilyClient
            ) =>
                Results.Ok(
                    new
                    {
                        maintenance = maintenanceMode.IsEnabled,
                        aiConfigured = agentFactory.IsConfigured,
                        webSearchAvailable = tavilyClient.IsConfigured,
                    }
                )
        )
        .WithTags("System")
        .AllowAnonymous();

    // ── Auto-Migrate Database ──
    {
        using var scope = app.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<ClariveDbContext>();
        for (var attempt = 1; attempt <= 10; attempt++)
        {
            try
            {
                await db.Database.MigrateAsync();
                break;
            }
            catch (Exception ex) when (attempt < 10)
            {
                Log.Warning(ex, "Migration attempt {Attempt} failed, retrying in 3s...", attempt);
                await Task.Delay(3000);
            }
        }
    }

    // ── Seed Data (Testing only) ──
    if (app.Environment.IsEnvironment("Testing"))
        await SeedData.InitializeAsync(app.Services);

    app.Run();
}
catch (Exception ex)
{
    Log.Fatal(ex, "Application terminated unexpectedly");
}
finally
{
    Log.CloseAndFlush();
}
