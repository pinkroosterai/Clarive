namespace Clarive.Api.Services;

public enum ConfigSection
{
    Authentication,
    Ai,
    Payments,
    Email,
    Monitoring,
    Application
}

public record ConfigDefinition(
    string Key,
    string Label,
    string Description,
    ConfigSection Section,
    bool IsSecret,
    bool RequiresRestart,
    string? ValidationHint = null);

public static class ConfigRegistry
{
    public static readonly IReadOnlyList<ConfigDefinition> All = new[]
    {
        // ── Authentication (Google OAuth) ──
        new ConfigDefinition("Google:ClientId", "Google OAuth Client ID",
            "OAuth 2.0 client ID from Google Cloud Console. Also requires frontend container restart.",
            ConfigSection.Authentication, false, true,
            "e.g., 123456789.apps.googleusercontent.com"),

        new ConfigDefinition("Google:ClientSecret", "Google OAuth Client Secret",
            "OAuth 2.0 client secret from Google Cloud Console",
            ConfigSection.Authentication, true, true),

        // ── Authentication (JWT) ──
        new ConfigDefinition("Jwt:Secret", "JWT Signing Secret",
            "Secret key used to sign and verify JWT tokens",
            ConfigSection.Authentication, true, true,
            "Minimum 32 characters"),

        new ConfigDefinition("Jwt:Issuer", "JWT Issuer",
            "Issuer claim embedded in JWT tokens",
            ConfigSection.Authentication, false, true),

        new ConfigDefinition("Jwt:Audience", "JWT Audience",
            "Audience claim embedded in JWT tokens",
            ConfigSection.Authentication, false, true),

        new ConfigDefinition("Jwt:ExpirationMinutes", "Token Expiration (minutes)",
            "Access token lifetime in minutes",
            ConfigSection.Authentication, false, false,
            "Default: 15"),

        new ConfigDefinition("Jwt:RefreshTokenExpirationDays", "Refresh Token Expiration (days)",
            "Refresh token lifetime in days",
            ConfigSection.Authentication, false, false,
            "Default: 7"),

        // ── AI (OpenAI) ──
        new ConfigDefinition("Ai:OpenAiApiKey", "OpenAI API Key",
            "API key for OpenAI services. Requires restart for the AI client to pick up the new key.",
            ConfigSection.Ai, true, true,
            "sk-..."),

        new ConfigDefinition("Ai:DefaultModel", "Default AI Model",
            "Model used for standard AI operations (clarification, evaluation, decomposition)",
            ConfigSection.Ai, false, true,
            "e.g., gpt-4o-mini"),

        new ConfigDefinition("Ai:PremiumModel", "Premium AI Model",
            "Model used for premium AI operations (prompt generation)",
            ConfigSection.Ai, false, true,
            "e.g., gpt-4o"),

        // ── Payments (Stripe) ──
        new ConfigDefinition("Stripe:SecretKey", "Stripe Secret Key",
            "Stripe API secret key for server-side operations",
            ConfigSection.Payments, true, true,
            "sk_live_... or sk_test_..."),

        new ConfigDefinition("Stripe:WebhookSecret", "Stripe Webhook Secret",
            "Secret for verifying Stripe webhook event signatures",
            ConfigSection.Payments, true, true,
            "whsec_..."),

        new ConfigDefinition("Stripe:PublishableKey", "Stripe Publishable Key",
            "Client-side Stripe key returned to the frontend via billing endpoints",
            ConfigSection.Payments, false, true,
            "pk_live_... or pk_test_..."),

        new ConfigDefinition("Billing:FreeMonthlyCredits", "Free Monthly Credits",
            "Number of free AI credits granted per month",
            ConfigSection.Payments, false, false,
            "Default: 20"),

        // ── Payments (Credit Packs) ──
        new ConfigDefinition("Billing:CreditPacks:0:Credits", "Credit Pack 1 — Credits",
            "Number of credits in the first credit pack",
            ConfigSection.Payments, false, false,
            "e.g., 50"),

        new ConfigDefinition("Billing:CreditPacks:0:PriceInCents", "Credit Pack 1 — Price (cents)",
            "Price in cents for the first credit pack",
            ConfigSection.Payments, false, false,
            "e.g., 499"),

        new ConfigDefinition("Billing:CreditPacks:0:StripePriceId", "Credit Pack 1 — Stripe Price ID",
            "Stripe Price ID for the first credit pack checkout",
            ConfigSection.Payments, false, false,
            "e.g., price_xxx"),

        new ConfigDefinition("Billing:CreditPacks:1:Credits", "Credit Pack 2 — Credits",
            "Number of credits in the second credit pack",
            ConfigSection.Payments, false, false,
            "e.g., 200"),

        new ConfigDefinition("Billing:CreditPacks:1:PriceInCents", "Credit Pack 2 — Price (cents)",
            "Price in cents for the second credit pack",
            ConfigSection.Payments, false, false,
            "e.g., 1499"),

        new ConfigDefinition("Billing:CreditPacks:1:StripePriceId", "Credit Pack 2 — Stripe Price ID",
            "Stripe Price ID for the second credit pack checkout",
            ConfigSection.Payments, false, false,
            "e.g., price_xxx"),

        new ConfigDefinition("Billing:CreditPacks:2:Credits", "Credit Pack 3 — Credits",
            "Number of credits in the third credit pack",
            ConfigSection.Payments, false, false,
            "e.g., 500"),

        new ConfigDefinition("Billing:CreditPacks:2:PriceInCents", "Credit Pack 3 — Price (cents)",
            "Price in cents for the third credit pack",
            ConfigSection.Payments, false, false,
            "e.g., 2999"),

        new ConfigDefinition("Billing:CreditPacks:2:StripePriceId", "Credit Pack 3 — Stripe Price ID",
            "Stripe Price ID for the third credit pack checkout",
            ConfigSection.Payments, false, false,
            "e.g., price_xxx"),

        // ── Email (Resend) ──
        new ConfigDefinition("Email:Provider", "Email Provider",
            "Email delivery provider. Set to 'resend' to enable Resend, or 'console' for dev logging.",
            ConfigSection.Email, false, true,
            "'console' or 'resend'"),

        new ConfigDefinition("Email:ApiKey", "Email API Key (Resend)",
            "API key for the Resend email service",
            ConfigSection.Email, true, true,
            "re_..."),

        new ConfigDefinition("Email:FromAddress", "Sender Email Address",
            "The 'from' address used when sending emails",
            ConfigSection.Email, false, false,
            "e.g., noreply@example.com"),

        new ConfigDefinition("Email:FromName", "Sender Display Name",
            "The display name shown in the email 'from' field",
            ConfigSection.Email, false, false),

        // ── Monitoring (Sentry) ──
        new ConfigDefinition("Sentry:Dsn", "Sentry DSN",
            "Sentry Data Source Name for error tracking. Leave empty to disable Sentry.",
            ConfigSection.Monitoring, false, true,
            "https://...@sentry.io/..."),

        new ConfigDefinition("Sentry:TracesSampleRate", "Traces Sample Rate",
            "Percentage of transactions to send to Sentry for performance monitoring",
            ConfigSection.Monitoring, false, true,
            "0.0 to 1.0, default: 0.2"),

        new ConfigDefinition("Sentry:Release", "Release Tag",
            "Release identifier reported to Sentry for version tracking",
            ConfigSection.Monitoring, false, true),

        // ── Application ──
        new ConfigDefinition("App:FrontendUrl", "Frontend URL",
            "Public URL of the frontend application, used in email links and invitations",
            ConfigSection.Application, false, false,
            "e.g., https://clarive.example.com"),

        new ConfigDefinition("RateLimiting:PermitLimit", "Rate Limit (requests/minute)",
            "Maximum requests per minute per IP for standard endpoints",
            ConfigSection.Application, false, false,
            "Default: 20"),

        new ConfigDefinition("RateLimiting:StrictPermitLimit", "Strict Rate Limit (requests/15min)",
            "Maximum requests per 15 minutes per IP for sensitive endpoints (login, register)",
            ConfigSection.Application, false, false,
            "Default: 5"),
    };

    public static readonly IReadOnlyDictionary<string, ConfigDefinition> ByKey =
        All.ToDictionary(d => d.Key, StringComparer.OrdinalIgnoreCase);

    public static IEnumerable<ConfigDefinition> GetBySection(ConfigSection section) =>
        All.Where(d => d.Section == section);
}
