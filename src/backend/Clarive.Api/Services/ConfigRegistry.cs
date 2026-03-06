namespace Clarive.Api.Services;

public enum ConfigSection
{
    Authentication,
    Ai,
    Email,
    Application
}

public enum ConfigInputType
{
    Text,
    Number,
    Email,
    Password,
    Select,
    Url
}

public record ConfigVisibleWhen(string Key, string[] Values);

public record ConfigDefinition(
    string Key,
    string Label,
    string Description,
    ConfigSection Section,
    bool IsSecret,
    bool RequiresRestart,
    string? ValidationHint = null,
    ConfigInputType InputType = ConfigInputType.Text,
    string[]? SelectOptions = null,
    string? SubGroup = null,
    ConfigVisibleWhen? VisibleWhen = null);

public static class ConfigRegistry
{
    public static readonly IReadOnlyList<ConfigDefinition> All = new[]
    {
        // ── Authentication › Google OAuth ──
        new ConfigDefinition("Google:ClientId", "Google OAuth Client ID",
            "OAuth 2.0 client ID from Google Cloud Console. Also requires frontend container restart.",
            ConfigSection.Authentication, false, true,
            "e.g., 123456789.apps.googleusercontent.com",
            SubGroup: "Google OAuth"),

        new ConfigDefinition("Google:ClientSecret", "Google OAuth Client Secret",
            "OAuth 2.0 client secret from Google Cloud Console",
            ConfigSection.Authentication, true, false,
            SubGroup: "Google OAuth"),

        // ── Authentication › JWT Tokens ──
        new ConfigDefinition("Jwt:ExpirationMinutes", "Token Expiration (minutes)",
            "Access token lifetime in minutes. Only affects newly issued tokens.",
            ConfigSection.Authentication, false, false,
            "Default: 15",
            ConfigInputType.Number, SubGroup: "JWT Tokens"),

        new ConfigDefinition("Jwt:RefreshTokenExpirationDays", "Refresh Token Expiration (days)",
            "Refresh token lifetime in days. Only affects newly issued tokens.",
            ConfigSection.Authentication, false, false,
            "Default: 7",
            ConfigInputType.Number, SubGroup: "JWT Tokens"),

        // ── AI (OpenAI-compatible) ──
        new ConfigDefinition("Ai:EndpointUrl", "API Endpoint URL",
            "Custom endpoint for OpenAI-compatible providers (Ollama, LiteLLM, vLLM, etc.). Leave empty for default OpenAI.",
            ConfigSection.Ai, false, false,
            "e.g., https://api.openai.com/v1",
            ConfigInputType.Url),

        new ConfigDefinition("Ai:OpenAiApiKey", "API Key",
            "API key for your OpenAI-compatible provider.",
            ConfigSection.Ai, true, false,
            "sk-..."),

        new ConfigDefinition("Ai:DefaultModel", "Default AI Model",
            "Model used for standard AI operations (clarification, evaluation, decomposition)",
            ConfigSection.Ai, false, false,
            "e.g., gpt-4o-mini"),

        new ConfigDefinition("Ai:PremiumModel", "Premium AI Model",
            "Model used for premium AI operations (prompt generation)",
            ConfigSection.Ai, false, false,
            "e.g., gpt-4o"),

        // ── Email › Provider ──
        new ConfigDefinition("Email:Provider", "Email Provider",
            "Email delivery provider. 'none' disables emails and skips verification for new users. Requires restart to switch.",
            ConfigSection.Email, false, true,
            SubGroup: "Provider",
            InputType: ConfigInputType.Select, SelectOptions: ["none", "console", "resend", "smtp"]),

        new ConfigDefinition("Email:ApiKey", "Email API Key (Resend)",
            "API key for the Resend email service. Only needed when provider is 'resend'.",
            ConfigSection.Email, true, false,
            "re_...",
            SubGroup: "Provider",
            VisibleWhen: new ConfigVisibleWhen("Email:Provider", ["resend"])),

        // ── Email › SMTP Server ──
        new ConfigDefinition("Email:SmtpHost", "SMTP Host",
            "SMTP server hostname",
            ConfigSection.Email, false, false,
            "e.g., smtp.gmail.com",
            SubGroup: "SMTP Server",
            VisibleWhen: new ConfigVisibleWhen("Email:Provider", ["smtp"])),

        new ConfigDefinition("Email:SmtpPort", "SMTP Port",
            "SMTP server port",
            ConfigSection.Email, false, false,
            "Default: 587",
            ConfigInputType.Number, SubGroup: "SMTP Server",
            VisibleWhen: new ConfigVisibleWhen("Email:Provider", ["smtp"])),

        new ConfigDefinition("Email:SmtpUsername", "SMTP Username",
            "Username for SMTP authentication. Leave empty if not required.",
            ConfigSection.Email, false, false,
            SubGroup: "SMTP Server",
            VisibleWhen: new ConfigVisibleWhen("Email:Provider", ["smtp"])),

        new ConfigDefinition("Email:SmtpPassword", "SMTP Password",
            "Password for SMTP authentication",
            ConfigSection.Email, true, false,
            SubGroup: "SMTP Server",
            VisibleWhen: new ConfigVisibleWhen("Email:Provider", ["smtp"])),

        new ConfigDefinition("Email:SmtpUseTls", "Use TLS",
            "Enable STARTTLS encryption for the SMTP connection",
            ConfigSection.Email, false, false,
            SubGroup: "SMTP Server",
            InputType: ConfigInputType.Select, SelectOptions: ["true", "false"],
            VisibleWhen: new ConfigVisibleWhen("Email:Provider", ["smtp"])),

        // ── Email › Sender ──
        new ConfigDefinition("Email:FromAddress", "Sender Email Address",
            "The 'from' address used when sending emails",
            ConfigSection.Email, false, false,
            "e.g., noreply@example.com",
            ConfigInputType.Email, SubGroup: "Sender",
            VisibleWhen: new ConfigVisibleWhen("Email:Provider", ["resend", "smtp"])),

        new ConfigDefinition("Email:FromName", "Sender Display Name",
            "The display name shown in the email 'from' field",
            ConfigSection.Email, false, false,
            SubGroup: "Sender",
            VisibleWhen: new ConfigVisibleWhen("Email:Provider", ["resend", "smtp"])),

        // ── Application › General ──
        new ConfigDefinition("App:AllowRegistration", "Allow New Registrations",
            "Allow new users to create accounts. When disabled, only invited users and existing accounts can log in. The first user can always register.",
            ConfigSection.Application, false, false,
            SubGroup: "General",
            InputType: ConfigInputType.Select, SelectOptions: ["true", "false"]),

        new ConfigDefinition("App:FrontendUrl", "Frontend URL",
            "Public URL of the frontend application, used in email links and invitations",
            ConfigSection.Application, false, false,
            "e.g., https://clarive.example.com",
            ConfigInputType.Url, SubGroup: "General"),

        // ── Application › Rate Limiting ──
        new ConfigDefinition("RateLimiting:PermitLimit", "Rate Limit (requests/minute)",
            "Maximum requests per minute per IP for standard endpoints",
            ConfigSection.Application, false, false,
            "Default: 20",
            ConfigInputType.Number, SubGroup: "Rate Limiting"),

        new ConfigDefinition("RateLimiting:StrictPermitLimit", "Strict Rate Limit (requests/15min)",
            "Maximum requests per 15 minutes per IP for sensitive endpoints (login, register)",
            ConfigSection.Application, false, false,
            "Default: 5",
            ConfigInputType.Number, SubGroup: "Rate Limiting"),
    };

    public static readonly IReadOnlyDictionary<string, ConfigDefinition> ByKey =
        All.ToDictionary(d => d.Key, StringComparer.OrdinalIgnoreCase);

    public static IEnumerable<ConfigDefinition> GetBySection(ConfigSection section) =>
        All.Where(d => d.Section == section);
}
