using System.Text;
using System.Text.Json;
using System.Text.Json.Serialization;
using System.Threading.RateLimiting;
using Microsoft.AspNetCore.Authentication;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.AspNetCore.HttpOverrides;
using Microsoft.AspNetCore.RateLimiting;
using Microsoft.EntityFrameworkCore;
using Microsoft.IdentityModel.Tokens;
using Microsoft.OpenApi;
using Serilog;
using Clarive.Api.Auth;
using Clarive.Api.Data;
using Clarive.Api.Endpoints;
using Clarive.Api.Repositories.EfCore;
using Clarive.Api.Repositories.Interfaces;
using Clarive.Api.Seed;
using Clarive.Api.Middleware;
using Clarive.Api.Configuration;
using Clarive.Api.Services;
using Clarive.Api.Services.Agents;
using Clarive.Api.Services.Interfaces;
using Microsoft.Extensions.Diagnostics.HealthChecks;
using Clarive.Api.HealthChecks;
using Microsoft.Extensions.Options;
using Resend;
// ── Serilog Bootstrap (catches startup errors) ──
Log.Logger = new LoggerConfiguration()
    .WriteTo.Console()
    .CreateBootstrapLogger();

try
{

var builder = WebApplication.CreateBuilder(args);

// ── Serilog ──
builder.Services.AddSerilog((services, lc) =>
{
    lc.ReadFrom.Configuration(builder.Configuration)
      .ReadFrom.Services(services)
      .Enrich.FromLogContext()
      .Enrich.WithMachineName()
      .Enrich.WithThreadId();

});

// ── Validate required configuration ──
var connectionString = builder.Configuration.GetConnectionString("DefaultConnection");
if (string.IsNullOrWhiteSpace(connectionString))
    throw new InvalidOperationException(
        "ConnectionStrings:DefaultConnection is not configured. " +
        "Set it in appsettings.Development.json or the CONNECTIONSTRINGS__DEFAULTCONNECTION environment variable.");

// ── Database Configuration Override (highest priority, overrides env vars) ──
builder.Configuration.AddDatabaseConfiguration(
    connectionString,
    builder.Configuration["CONFIG_ENCRYPTION_KEY"]);

// ── JWT Settings ──
builder.Services.Configure<JwtSettings>(builder.Configuration.GetSection("Jwt"));
var jwtSettings = builder.Configuration.GetSection("Jwt").Get<JwtSettings>()!;

if (string.IsNullOrWhiteSpace(jwtSettings.Secret))
    throw new InvalidOperationException(
        "Jwt:Secret is not configured. " +
        "Set it in appsettings.Development.json or the JWT__SECRET environment variable.");

if (System.Text.Encoding.UTF8.GetByteCount(jwtSettings.Secret) < 32)
    throw new InvalidOperationException(
        "Jwt:Secret must be at least 32 bytes (256 bits) for HMAC-SHA256. " +
        "Current key is too short.");

// ── Authentication ──
builder.Services.AddAuthentication(JwtBearerDefaults.AuthenticationScheme)
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
                Encoding.UTF8.GetBytes(jwtSettings.Secret)),
            ValidateLifetime = true,
            ClockSkew = TimeSpan.FromMinutes(1)
        };
    })
    .AddScheme<AuthenticationSchemeOptions, ApiKeyAuthHandler>(
        ApiKeyAuthHandler.SchemeName, _ => { });

// ── Authorization ──
builder.Services.AddAuthorizationBuilder()
    .AddPolicy("AdminOnly", p => p.RequireRole("admin"))
    .AddPolicy("EditorOrAdmin", p => p.RequireRole("admin", "editor"))
    .AddPolicy("SuperUser", p => p.RequireClaim("superUser", "true"));

// ── CORS ──
var corsOrigins = builder.Configuration.GetSection("Cors:AllowedOrigins").Get<string[]>()
    ?? ["http://localhost:8080"];
builder.Services.AddCors(options =>
{
    options.AddPolicy("AppCors", policy =>
    {
        if (builder.Environment.IsDevelopment())
            policy.SetIsOriginAllowed(_ => true);
        else
            policy.WithOrigins(corsOrigins);

        policy.AllowAnyHeader()
            .AllowAnyMethod()
            .AllowCredentials();
    });
});

// ── Swagger (Swashbuckle v10 API) ──
builder.Services.AddEndpointsApiExplorer();
builder.Services.AddSwaggerGen(options =>
{
    options.SwaggerDoc("v1", new OpenApiInfo
    {
        Title = "Clarive API",
        Version = "v1",
        Description = "REST API for the Clarive prompt management platform."
    });
    options.AddSecurityDefinition("bearer", new OpenApiSecurityScheme
    {
        Type = SecuritySchemeType.Http,
        Scheme = "bearer",
        BearerFormat = "JWT",
        Description = "JWT Authorization header using the Bearer scheme."
    });
    options.AddSecurityDefinition("apiKey", new OpenApiSecurityScheme
    {
        Type = SecuritySchemeType.ApiKey,
        In = ParameterLocation.Header,
        Name = "X-Api-Key",
        Description = "API key for public endpoint access."
    });
    options.AddSecurityRequirement(document => new OpenApiSecurityRequirement
    {
        [new OpenApiSecuritySchemeReference("bearer", document)] = []
    });
});

// ── JSON Serialization ──
builder.Services.ConfigureHttpJsonOptions(options =>
{
    options.SerializerOptions.PropertyNamingPolicy = JsonNamingPolicy.CamelCase;
    options.SerializerOptions.Converters.Add(
        new JsonStringEnumConverter(JsonNamingPolicy.SnakeCaseLower));
    options.SerializerOptions.DefaultIgnoreCondition = JsonIgnoreCondition.WhenWritingNull;
});

// ── Tenant isolation ──
builder.Services.AddHttpContextAccessor();
builder.Services.AddScoped<ITenantProvider, HttpContextTenantProvider>();

// ── Database ──
builder.Services.AddDbContext<ClariveDbContext>(options =>
{
    options.UseNpgsql(connectionString);
    // Suppress during multi-phase development; remove after generating the migration
    options.ConfigureWarnings(w => w
        .Ignore(Microsoft.EntityFrameworkCore.Diagnostics.RelationalEventId.PendingModelChangesWarning)
        .Ignore(Microsoft.EntityFrameworkCore.Diagnostics.CoreEventId.FirstWithoutOrderByAndFilterWarning)
        .Ignore(Microsoft.EntityFrameworkCore.Diagnostics.RelationalEventId.MultipleCollectionIncludeWarning));
});

// ── In-Memory Cache ──
builder.Services.AddMemoryCache(options => options.SizeLimit = 1024);

// ── Repositories (Scoped — one DbContext per request) ──
builder.Services.AddScoped<ITenantRepository, EfTenantRepository>();
builder.Services.AddScoped<IUserRepository, EfUserRepository>();
builder.Services.AddScoped<IFolderRepository, EfFolderRepository>();
builder.Services.AddScoped<IEntryRepository, EfEntryRepository>();
builder.Services.AddScoped<IToolRepository, EfToolRepository>();
builder.Services.AddScoped<IApiKeyRepository, EfApiKeyRepository>();
builder.Services.AddScoped<IAuditLogRepository, EfAuditLogRepository>();
builder.Services.AddScoped<IAiSessionRepository, EfAiSessionRepository>();
builder.Services.AddScoped<IRefreshTokenRepository, EfRefreshTokenRepository>();
builder.Services.AddScoped<ITokenRepository, EfTokenRepository>();
builder.Services.AddScoped<ILoginSessionRepository, EfLoginSessionRepository>();
builder.Services.AddScoped<IInvitationRepository, EfInvitationRepository>();
builder.Services.AddScoped<ITenantMembershipRepository, EfTenantMembershipRepository>();
builder.Services.AddScoped<ITagRepository, EfTagRepository>();
builder.Services.AddScoped<IFavoriteRepository, EfFavoriteRepository>();
builder.Services.AddScoped<IPlaygroundRunRepository, EfPlaygroundRunRepository>();
builder.Services.AddScoped<IAiProviderRepository, EfAiProviderRepository>();
builder.Services.AddScoped<IServiceConfigRepository, EfServiceConfigRepository>();

// ── Services ──
builder.Services.AddSingleton<MaintenanceModeService>();
builder.Services.AddSingleton<IMaintenanceModeService>(sp => sp.GetRequiredService<MaintenanceModeService>());
builder.Services.AddSingleton<JwtService>();
builder.Services.AddSingleton<PasswordHasher>();
builder.Services.AddSingleton<IEncryptionService, EncryptionService>();
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
builder.Services.AddScoped<AiProviderService>();
builder.Services.Configure<AvatarSettings>(builder.Configuration.GetSection("Avatar"));
builder.Services.AddScoped<IAvatarService, AvatarService>();
// ── Email (all providers registered, resolved dynamically per-request) ──
builder.Services.AddHttpClient<ResendClient>();
builder.Services.AddSingleton<IConfigureOptions<ResendClientOptions>>(sp =>
{
    var config = sp.GetRequiredService<IConfiguration>();
    return new ConfigureOptions<ResendClientOptions>(o => o.ApiToken = config["Email:ApiKey"] ?? "");
});
builder.Services.AddTransient<IResend, ResendClient>();
builder.Services.AddScoped<ResendEmailService>();
builder.Services.AddScoped<SmtpEmailService>();
builder.Services.AddScoped<ConsoleEmailService>();
builder.Services.AddScoped<IEmailService>(sp =>
{
    var config = sp.GetRequiredService<IConfiguration>();
    var provider = config["Email:Provider"] ?? "none";
    return provider.ToLowerInvariant() switch
    {
        "resend" => sp.GetRequiredService<ResendEmailService>(),
        "smtp" => sp.GetRequiredService<SmtpEmailService>(),
        _ => sp.GetRequiredService<ConsoleEmailService>()
    };
});
builder.Services.AddScoped<IOnboardingSeeder, OnboardingSeeder>();

// ── Settings ──
builder.Services.Configure<AppSettings>(builder.Configuration.GetSection("App"));
builder.Services.Configure<EmailSettings>(builder.Configuration.GetSection("Email"));

// ── Google OAuth ──
builder.Services.Configure<GoogleAuthSettings>(builder.Configuration.GetSection("Google"));
var googleSettings = builder.Configuration.GetSection("Google").Get<GoogleAuthSettings>() ?? new GoogleAuthSettings();
if (!string.IsNullOrWhiteSpace(googleSettings.ClientId))
{
    builder.Services.AddSingleton<IGoogleAuthService, GoogleAuthService>();
}
else
{
    builder.Services.AddSingleton<IGoogleAuthService, NullGoogleAuthService>();
    Log.Warning("Google OAuth disabled: Google:ClientId not configured");
}

// ── AI Configuration (Agent-based) ──
builder.Services.Configure<AiSettings>(builder.Configuration.GetSection("Ai"));
builder.Services.AddSingleton<IAgentFactory, OpenAIAgentFactory>();
builder.Services.AddSingleton<IAgentSessionPool, AgentSessionPool>();
builder.Services.AddScoped<IPromptOrchestrator, PromptOrchestrator>();
builder.Services.AddScoped<IMcpImportService, McpImportService>();
builder.Services.AddSingleton<ITavilyClientService, TavilyClientService>();

// ── Background Services ──
builder.Services.AddHostedService<Clarive.Api.Services.Background.AccountPurgeBackgroundService>();
builder.Services.AddHostedService<Clarive.Api.Services.Background.TokenCleanupBackgroundService>();
builder.Services.AddHostedService<Clarive.Api.Services.Background.AiSessionCleanupService>();
builder.Services.AddHostedService<Clarive.Api.Services.Background.MaintenanceModeSyncService>();

// ── Rate Limiting ──
builder.Services.AddRateLimiter(options =>
{
    options.RejectionStatusCode = StatusCodes.Status429TooManyRequests;
    options.OnRejected = async (context, _) =>
    {
        var http = context.HttpContext;
        var logger = http.RequestServices.GetRequiredService<ILoggerFactory>()
            .CreateLogger("RateLimiter");
        logger.LogWarning(
            "Rate limit exceeded for {ClientIp} on {Method} {Path}",
            http.Connection.RemoteIpAddress?.ToString() ?? "unknown",
            http.Request.Method,
            http.Request.Path);

        http.Response.StatusCode = StatusCodes.Status429TooManyRequests;
        await http.Response.WriteAsJsonAsync(new { error = new { code = "RATE_LIMITED", message = "Too many requests." } });
    };
    options.AddPolicy("auth", httpContext =>
    {
        var permitLimit = httpContext.RequestServices
            .GetRequiredService<IConfiguration>()
            .GetValue("RateLimiting:PermitLimit", 20);
        return RateLimitPartition.GetFixedWindowLimiter(
            partitionKey: httpContext.Connection.RemoteIpAddress?.ToString() ?? "unknown",
            factory: _ => new FixedWindowRateLimiterOptions
            {
                PermitLimit = permitLimit,
                Window = TimeSpan.FromMinutes(1),
                QueueLimit = 0
            });
    });
    options.AddPolicy("strict-auth", httpContext =>
    {
        var strictLimit = httpContext.RequestServices
            .GetRequiredService<IConfiguration>()
            .GetValue("RateLimiting:StrictPermitLimit", 5);
        return RateLimitPartition.GetFixedWindowLimiter(
            partitionKey: httpContext.Connection.RemoteIpAddress?.ToString() ?? "unknown",
            factory: _ => new FixedWindowRateLimiterOptions
            {
                PermitLimit = strictLimit,
                Window = TimeSpan.FromMinutes(15),
                QueueLimit = 0
            });
    });
});

// ── Health Checks ──
builder.Services.AddHealthChecks()
    .AddNpgSql(
        sp => sp.GetRequiredService<IConfiguration>()
                .GetConnectionString("DefaultConnection")!,
        name: "postgresql",
        tags: ["ready"])
    .AddCheck<OpenAiHealthCheck>(
        name: "openai",
        failureStatus: HealthStatus.Degraded,
        tags: ["ready"]);

var app = builder.Build();

// ── Middleware ──
app.UseForwardedHeaders(new ForwardedHeadersOptions
{
    ForwardedHeaders = ForwardedHeaders.XForwardedFor | ForwardedHeaders.XForwardedProto
});
app.UseMiddleware<SecurityHeadersMiddleware>();
app.UseMiddleware<ErrorHandlingMiddleware>();
app.UseMiddleware<MaintenanceModeMiddleware>();
app.UseSerilogRequestLogging(options =>
{
    options.GetLevel = (httpContext, elapsed, ex) =>
    {
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
        diagnosticContext.Set("ClientIp",
            httpContext.Connection.RemoteIpAddress?.ToString() ?? "unknown");

        // Auth scheme attempted (useful for debugging auth failures)
        string authScheme = "anonymous";
        if (httpContext.Request.Headers.ContainsKey("Authorization")) authScheme = "jwt";
        else if (httpContext.Request.Headers.ContainsKey("X-Api-Key")) authScheme = "apikey";
        diagnosticContext.Set("AuthScheme", authScheme);

        var user = httpContext.User;
        if (user.Identity?.IsAuthenticated == true)
        {
            diagnosticContext.Set("TenantId", user.FindFirst("tenantId")?.Value ?? "");
            var userId = user.FindFirst(System.Security.Claims.ClaimTypes.NameIdentifier)?.Value;
            if (userId is not null)
            {
                diagnosticContext.Set("UserId", userId);
                diagnosticContext.Set("UserRole", user.FindFirst(System.Security.Claims.ClaimTypes.Role)?.Value ?? "");
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
app.UseRateLimiter();

// ── Health Checks ──
app.MapHealthChecks("/healthz/live", new Microsoft.AspNetCore.Diagnostics.HealthChecks.HealthCheckOptions
{
    Predicate = _ => false,
    ResponseWriter = HealthCheckResponseWriter.WriteAsync
})
.AllowAnonymous()
.DisableRateLimiting()
.ExcludeFromDescription();

app.MapHealthChecks("/healthz/ready", new Microsoft.AspNetCore.Diagnostics.HealthChecks.HealthCheckOptions
{
    Predicate = check => check.Tags.Contains("ready"),
    ResponseWriter = HealthCheckResponseWriter.WriteAsync
})
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

app.MapGet("/api/status", (IMaintenanceModeService maintenanceMode, IAgentFactory agentFactory, ITavilyClientService tavilyClient) =>
    Results.Ok(new { maintenance = maintenanceMode.IsEnabled, aiConfigured = agentFactory.IsConfigured, webSearchAvailable = tavilyClient.IsConfigured }))
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
