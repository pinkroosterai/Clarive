namespace Clarive.Api.Services;

public enum ConfigSection
{
    Authentication,
    Ai,
    Email,
    Application,
}

public enum ConfigInputType
{
    Text,
    Number,
    Email,
    Password,
    Select,
    Url,
    Toggle,
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
    ConfigVisibleWhen? VisibleWhen = null
);

public static class ConfigRegistry
{
    public static readonly IReadOnlyList<ConfigDefinition> All = new[]
    {
        // ── Authentication › Google OAuth ──
        new ConfigDefinition(
            "Google:ClientId",
            "Google OAuth Client ID",
            "OAuth 2.0 client ID from Google Cloud Console. Enables the \"Sign in with Google\" button on the login page. Both client ID and secret must be set for Google login to appear. Changing this requires restarting both the backend and frontend containers.",
            ConfigSection.Authentication,
            false,
            true,
            "e.g., 123456789.apps.googleusercontent.com",
            SubGroup: "Google OAuth"
        ),
        new ConfigDefinition(
            "Google:ClientSecret",
            "Google OAuth Client Secret",
            "OAuth 2.0 client secret paired with the client ID above. Keep this value confidential — it authenticates your application with Google's OAuth servers.",
            ConfigSection.Authentication,
            true,
            false,
            SubGroup: "Google OAuth"
        ),
        // ── Authentication › JWT Tokens ──
        new ConfigDefinition(
            "Jwt:ExpirationMinutes",
            "Token Expiration (minutes)",
            "How long access tokens remain valid before users must refresh. Shorter values are more secure but cause more frequent token refreshes. Already-issued tokens are not affected by changes.",
            ConfigSection.Authentication,
            false,
            false,
            "Default: 15",
            ConfigInputType.Number,
            SubGroup: "JWT Tokens"
        ),
        new ConfigDefinition(
            "Jwt:RefreshTokenExpirationDays",
            "Refresh Token Expiration (days)",
            "How long users stay logged in without re-entering credentials. After this period, they must log in again. Already-issued tokens are not affected by changes.",
            ConfigSection.Authentication,
            false,
            false,
            "Default: 7",
            ConfigInputType.Number,
            SubGroup: "JWT Tokens"
        ),
        // ── AI › Generation ──
        new ConfigDefinition(
            "Ai:Generation:Model",
            "Generation Model",
            "Model for the primary prompt generation workflow (AI Wizard). This task benefits from a more capable model since it produces the actual prompt content.",
            ConfigSection.Ai,
            false,
            false,
            "e.g., gpt-4o",
            SubGroup: "Generation"
        ),
        new ConfigDefinition(
            "Ai:Generation:ProviderId",
            "Generation Provider",
            "Provider ID for the generation model. Set automatically when selecting a model.",
            ConfigSection.Ai,
            false,
            false,
            SubGroup: "Generation"
        ),
        new ConfigDefinition(
            "Ai:Generation:Temperature",
            "Generation Temperature",
            "Override temperature for prompt generation. Leave empty to use the model's default.",
            ConfigSection.Ai,
            false,
            false,
            "e.g., 0.9",
            ConfigInputType.Number,
            SubGroup: "Generation Overrides"
        ),
        new ConfigDefinition(
            "Ai:Generation:MaxTokens",
            "Generation Max Tokens",
            "Override max output tokens for prompt generation. Leave empty to use the model's default.",
            ConfigSection.Ai,
            false,
            false,
            "e.g., 8192",
            ConfigInputType.Number,
            SubGroup: "Generation Overrides"
        ),
        new ConfigDefinition(
            "Ai:Generation:ReasoningEffort",
            "Generation Reasoning Effort",
            "Override reasoning effort for prompt generation (only applies to reasoning models).",
            ConfigSection.Ai,
            false,
            false,
            SubGroup: "Generation Overrides",
            InputType: ConfigInputType.Select,
            SelectOptions: ["", "low", "medium", "high", "extra-high"]
        ),
        // ── AI › Evaluation ──
        new ConfigDefinition(
            "Ai:Evaluation:Model",
            "Evaluation Model",
            "Model for quality scoring after prompt generation. A fast, cost-effective model works well here.",
            ConfigSection.Ai,
            false,
            false,
            "e.g., gpt-4o-mini",
            SubGroup: "Evaluation"
        ),
        new ConfigDefinition(
            "Ai:Evaluation:ProviderId",
            "Evaluation Provider",
            "Provider ID for the evaluation model. Set automatically when selecting a model.",
            ConfigSection.Ai,
            false,
            false,
            SubGroup: "Evaluation"
        ),
        new ConfigDefinition(
            "Ai:Evaluation:Temperature",
            "Evaluation Temperature",
            "Override temperature for quality evaluation. Leave empty to use the model's default.",
            ConfigSection.Ai,
            false,
            false,
            "e.g., 0.3",
            ConfigInputType.Number,
            SubGroup: "Evaluation Overrides"
        ),
        new ConfigDefinition(
            "Ai:Evaluation:MaxTokens",
            "Evaluation Max Tokens",
            "Override max output tokens for quality evaluation. Leave empty to use the model's default.",
            ConfigSection.Ai,
            false,
            false,
            "e.g., 4096",
            ConfigInputType.Number,
            SubGroup: "Evaluation Overrides"
        ),
        new ConfigDefinition(
            "Ai:Evaluation:ReasoningEffort",
            "Evaluation Reasoning Effort",
            "Override reasoning effort for quality evaluation (only applies to reasoning models).",
            ConfigSection.Ai,
            false,
            false,
            SubGroup: "Evaluation Overrides",
            InputType: ConfigInputType.Select,
            SelectOptions: ["", "low", "medium", "high", "extra-high"]
        ),
        // ── AI › Clarification ──
        new ConfigDefinition(
            "Ai:Clarification:Model",
            "Clarification Model",
            "Model for generating follow-up clarification questions after prompt generation.",
            ConfigSection.Ai,
            false,
            false,
            "e.g., gpt-4o-mini",
            SubGroup: "Clarification"
        ),
        new ConfigDefinition(
            "Ai:Clarification:ProviderId",
            "Clarification Provider",
            "Provider ID for the clarification model. Set automatically when selecting a model.",
            ConfigSection.Ai,
            false,
            false,
            SubGroup: "Clarification"
        ),
        new ConfigDefinition(
            "Ai:Clarification:Temperature",
            "Clarification Temperature",
            "Override temperature for clarification questions. Leave empty to use the model's default.",
            ConfigSection.Ai,
            false,
            false,
            "e.g., 0.5",
            ConfigInputType.Number,
            SubGroup: "Clarification Overrides"
        ),
        new ConfigDefinition(
            "Ai:Clarification:MaxTokens",
            "Clarification Max Tokens",
            "Override max output tokens for clarification questions. Leave empty to use the model's default.",
            ConfigSection.Ai,
            false,
            false,
            "e.g., 2048",
            ConfigInputType.Number,
            SubGroup: "Clarification Overrides"
        ),
        new ConfigDefinition(
            "Ai:Clarification:ReasoningEffort",
            "Clarification Reasoning Effort",
            "Override reasoning effort for clarification (only applies to reasoning models).",
            ConfigSection.Ai,
            false,
            false,
            SubGroup: "Clarification Overrides",
            InputType: ConfigInputType.Select,
            SelectOptions: ["", "low", "medium", "high", "extra-high"]
        ),
        // ── AI › System Message ──
        new ConfigDefinition(
            "Ai:SystemMessage:Model",
            "System Message Model",
            "Model for generating system messages for prompt entries.",
            ConfigSection.Ai,
            false,
            false,
            "e.g., gpt-4o-mini",
            SubGroup: "System Message"
        ),
        new ConfigDefinition(
            "Ai:SystemMessage:ProviderId",
            "System Message Provider",
            "Provider ID for the system message model. Set automatically when selecting a model.",
            ConfigSection.Ai,
            false,
            false,
            SubGroup: "System Message"
        ),
        new ConfigDefinition(
            "Ai:SystemMessage:Temperature",
            "System Message Temperature",
            "Override temperature for system message generation. Leave empty to use the model's default.",
            ConfigSection.Ai,
            false,
            false,
            "e.g., 0.7",
            ConfigInputType.Number,
            SubGroup: "System Message Overrides"
        ),
        new ConfigDefinition(
            "Ai:SystemMessage:MaxTokens",
            "System Message Max Tokens",
            "Override max output tokens for system message generation. Leave empty to use the model's default.",
            ConfigSection.Ai,
            false,
            false,
            "e.g., 4096",
            ConfigInputType.Number,
            SubGroup: "System Message Overrides"
        ),
        new ConfigDefinition(
            "Ai:SystemMessage:ReasoningEffort",
            "System Message Reasoning Effort",
            "Override reasoning effort for system message generation (only applies to reasoning models).",
            ConfigSection.Ai,
            false,
            false,
            SubGroup: "System Message Overrides",
            InputType: ConfigInputType.Select,
            SelectOptions: ["", "low", "medium", "high", "extra-high"]
        ),
        // ── AI › Decomposition ──
        new ConfigDefinition(
            "Ai:Decomposition:Model",
            "Decomposition Model",
            "Model for splitting prompts into multi-step chain steps.",
            ConfigSection.Ai,
            false,
            false,
            "e.g., gpt-4o-mini",
            SubGroup: "Decomposition"
        ),
        new ConfigDefinition(
            "Ai:Decomposition:ProviderId",
            "Decomposition Provider",
            "Provider ID for the decomposition model. Set automatically when selecting a model.",
            ConfigSection.Ai,
            false,
            false,
            SubGroup: "Decomposition"
        ),
        new ConfigDefinition(
            "Ai:Decomposition:Temperature",
            "Decomposition Temperature",
            "Override temperature for prompt decomposition. Leave empty to use the model's default.",
            ConfigSection.Ai,
            false,
            false,
            "e.g., 0.5",
            ConfigInputType.Number,
            SubGroup: "Decomposition Overrides"
        ),
        new ConfigDefinition(
            "Ai:Decomposition:MaxTokens",
            "Decomposition Max Tokens",
            "Override max output tokens for prompt decomposition. Leave empty to use the model's default.",
            ConfigSection.Ai,
            false,
            false,
            "e.g., 4096",
            ConfigInputType.Number,
            SubGroup: "Decomposition Overrides"
        ),
        new ConfigDefinition(
            "Ai:Decomposition:ReasoningEffort",
            "Decomposition Reasoning Effort",
            "Override reasoning effort for prompt decomposition (only applies to reasoning models).",
            ConfigSection.Ai,
            false,
            false,
            SubGroup: "Decomposition Overrides",
            InputType: ConfigInputType.Select,
            SelectOptions: ["", "low", "medium", "high", "extra-high"]
        ),
        // ── AI › Fill Template Fields ──
        new ConfigDefinition(
            "Ai:FillTemplateFields:Model",
            "Fill Template Fields Model",
            "Model for generating template field example values.",
            ConfigSection.Ai,
            false,
            false,
            "e.g., gpt-4o-mini",
            SubGroup: "Fill Template Fields"
        ),
        new ConfigDefinition(
            "Ai:FillTemplateFields:ProviderId",
            "Fill Template Fields Provider",
            "Provider ID for the fill template fields model. Set automatically when selecting a model.",
            ConfigSection.Ai,
            false,
            false,
            SubGroup: "Fill Template Fields"
        ),
        new ConfigDefinition(
            "Ai:FillTemplateFields:Temperature",
            "Fill Template Fields Temperature",
            "Override temperature for template field generation. Leave empty to use the model's default.",
            ConfigSection.Ai,
            false,
            false,
            "e.g., 0.7",
            ConfigInputType.Number,
            SubGroup: "Fill Template Fields Overrides"
        ),
        new ConfigDefinition(
            "Ai:FillTemplateFields:MaxTokens",
            "Fill Template Fields Max Tokens",
            "Override max output tokens for template field generation. Leave empty to use the model's default.",
            ConfigSection.Ai,
            false,
            false,
            "e.g., 2048",
            ConfigInputType.Number,
            SubGroup: "Fill Template Fields Overrides"
        ),
        new ConfigDefinition(
            "Ai:FillTemplateFields:ReasoningEffort",
            "Fill Template Fields Reasoning Effort",
            "Override reasoning effort for template field generation (only applies to reasoning models).",
            ConfigSection.Ai,
            false,
            false,
            SubGroup: "Fill Template Fields Overrides",
            InputType: ConfigInputType.Select,
            SelectOptions: ["", "low", "medium", "high", "extra-high"]
        ),
        // ── AI › Playground Judge ──
        new ConfigDefinition(
            "Ai:PlaygroundJudge:Model",
            "Playground Judge Model",
            "Model for scoring playground run outputs across quality dimensions.",
            ConfigSection.Ai,
            false,
            false,
            "e.g., gpt-4o-mini",
            SubGroup: "Playground Judge"
        ),
        new ConfigDefinition(
            "Ai:PlaygroundJudge:ProviderId",
            "Playground Judge Provider",
            "Provider ID for the playground judge model. Set automatically when selecting a model.",
            ConfigSection.Ai,
            false,
            false,
            SubGroup: "Playground Judge"
        ),
        new ConfigDefinition(
            "Ai:PlaygroundJudge:Temperature",
            "Playground Judge Temperature",
            "Override temperature for playground output scoring. Leave empty to use the model's default.",
            ConfigSection.Ai,
            false,
            false,
            "e.g., 0.3",
            ConfigInputType.Number,
            SubGroup: "Playground Judge Overrides"
        ),
        new ConfigDefinition(
            "Ai:PlaygroundJudge:MaxTokens",
            "Playground Judge Max Tokens",
            "Override max output tokens for playground output scoring. Leave empty to use the model's default.",
            ConfigSection.Ai,
            false,
            false,
            "e.g., 4096",
            ConfigInputType.Number,
            SubGroup: "Playground Judge Overrides"
        ),
        new ConfigDefinition(
            "Ai:PlaygroundJudge:ReasoningEffort",
            "Playground Judge Reasoning Effort",
            "Override reasoning effort for playground output scoring (only applies to reasoning models).",
            ConfigSection.Ai,
            false,
            false,
            SubGroup: "Playground Judge Overrides",
            InputType: ConfigInputType.Select,
            SelectOptions: ["", "low", "medium", "high", "extra-high"]
        ),
        new ConfigDefinition(
            "Ai:AllowedModels",
            "Allowed Playground Models",
            "Restrict which models users can select in the AI Playground. When empty, all models from configured providers are available. Use this to control costs or limit access to specific models.",
            ConfigSection.Ai,
            false,
            false,
            "e.g., gpt-4o,gpt-4o-mini,gpt-5.2"
        ),
        new ConfigDefinition(
            "Ai:TavilyApiKey",
            "Tavily API Key",
            "API key for Tavily web search (tavily.com). When configured, the AI generation agent can research best practices, industry patterns, and current information while creating prompts — producing higher-quality, more informed results. Optional.",
            ConfigSection.Ai,
            true,
            false,
            "tvly-..."
        ),
        // ── Email › Provider ──
        new ConfigDefinition(
            "Email:Provider",
            "Email Provider",
            "Choose how Clarive sends emails (verification, password reset, invitations). Select 'resend' for the Resend API, 'smtp' for a custom mail server, or 'none' to disable emails entirely. When set to 'none', new users skip email verification.",
            ConfigSection.Email,
            false,
            false,
            SubGroup: "Provider",
            InputType: ConfigInputType.Select,
            SelectOptions: ["none", "resend", "smtp"]
        ),
        new ConfigDefinition(
            "Email:ApiKey",
            "Email API Key (Resend)",
            "API key from your Resend dashboard (resend.com/api-keys). Required when using Resend as the email provider.",
            ConfigSection.Email,
            true,
            false,
            "re_...",
            SubGroup: "Provider",
            VisibleWhen: new ConfigVisibleWhen("Email:Provider", ["resend"])
        ),
        // ── Email › SMTP Server ──
        new ConfigDefinition(
            "Email:SmtpHost",
            "SMTP Host",
            "Hostname of your SMTP mail server. Common examples: smtp.gmail.com (Gmail), smtp.office365.com (Microsoft 365), email-smtp.us-east-1.amazonaws.com (Amazon SES).",
            ConfigSection.Email,
            false,
            false,
            "e.g., smtp.gmail.com",
            SubGroup: "SMTP Server",
            VisibleWhen: new ConfigVisibleWhen("Email:Provider", ["smtp"])
        ),
        new ConfigDefinition(
            "Email:SmtpPort",
            "SMTP Port",
            "Port number for the SMTP server. Use 587 for STARTTLS (recommended), 465 for implicit SSL, or 25 for unencrypted (not recommended).",
            ConfigSection.Email,
            false,
            false,
            "Default: 587",
            ConfigInputType.Number,
            SubGroup: "SMTP Server",
            VisibleWhen: new ConfigVisibleWhen("Email:Provider", ["smtp"])
        ),
        new ConfigDefinition(
            "Email:SmtpUsername",
            "SMTP Username",
            "Username for authenticating with the SMTP server. Often the full email address. Leave empty if your server doesn't require authentication.",
            ConfigSection.Email,
            false,
            false,
            SubGroup: "SMTP Server",
            VisibleWhen: new ConfigVisibleWhen("Email:Provider", ["smtp"])
        ),
        new ConfigDefinition(
            "Email:SmtpPassword",
            "SMTP Password",
            "Password or app-specific password for SMTP authentication. For Gmail, use an App Password (not your regular password) from myaccount.google.com/apppasswords.",
            ConfigSection.Email,
            true,
            false,
            SubGroup: "SMTP Server",
            VisibleWhen: new ConfigVisibleWhen("Email:Provider", ["smtp"])
        ),
        new ConfigDefinition(
            "Email:SmtpUseTls",
            "Use TLS",
            "Enable STARTTLS encryption for the SMTP connection. Should be enabled for port 587. Disable only if your server doesn't support TLS (not recommended for production).",
            ConfigSection.Email,
            false,
            false,
            SubGroup: "SMTP Server",
            InputType: ConfigInputType.Select,
            SelectOptions: ["true", "false"],
            VisibleWhen: new ConfigVisibleWhen("Email:Provider", ["smtp"])
        ),
        // ── Email › Sender ──
        new ConfigDefinition(
            "Email:FromAddress",
            "Sender Email Address",
            "The email address that appears in the 'From' field of outgoing emails. Must be a verified sender in your email provider. Recipients see this when they receive verification, reset, or invitation emails.",
            ConfigSection.Email,
            false,
            false,
            "e.g., noreply@example.com",
            ConfigInputType.Email,
            SubGroup: "Sender",
            VisibleWhen: new ConfigVisibleWhen("Email:Provider", ["resend", "smtp"])
        ),
        new ConfigDefinition(
            "Email:FromName",
            "Sender Display Name",
            "The name shown alongside the sender email address (e.g., \"Clarive\" or \"Clarive Team\"). Recipients see this as the sender name in their inbox.",
            ConfigSection.Email,
            false,
            false,
            SubGroup: "Sender",
            VisibleWhen: new ConfigVisibleWhen("Email:Provider", ["resend", "smtp"])
        ),
        // ── Application › General ──
        new ConfigDefinition(
            "App:AllowRegistration",
            "Allow New Registrations",
            "Controls whether the public registration page is accessible. When disabled, only users who receive a workspace invitation can create accounts. The very first user can always register regardless of this setting, so you won't get locked out of a fresh instance.",
            ConfigSection.Application,
            false,
            false,
            SubGroup: "General",
            InputType: ConfigInputType.Toggle
        ),
        new ConfigDefinition(
            "App:FrontendUrl",
            "Frontend URL",
            "The public-facing URL where users access Clarive (e.g., https://clarive.example.com). Used to generate links in emails, invitations, and password reset flows. Must match the actual URL users visit in their browser.",
            ConfigSection.Application,
            false,
            false,
            "e.g., https://clarive.example.com",
            ConfigInputType.Url,
            SubGroup: "General"
        ),
        // ── Application › Rate Limiting ──
        new ConfigDefinition(
            "RateLimiting:PermitLimit",
            "Rate Limit (requests/minute)",
            "Maximum number of API requests allowed per minute per IP address for standard endpoints (browsing, editing, fetching data). Protects against abuse without affecting normal usage. Set higher for busy teams.",
            ConfigSection.Application,
            false,
            false,
            "Default: 20",
            ConfigInputType.Number,
            SubGroup: "Rate Limiting"
        ),
        new ConfigDefinition(
            "RateLimiting:StrictPermitLimit",
            "Strict Rate Limit (requests/15min)",
            "Maximum attempts per 15 minutes per IP for sensitive endpoints (login, register, password reset). Prevents brute-force attacks. Keep this low — legitimate users rarely hit this limit.",
            ConfigSection.Application,
            false,
            false,
            "Default: 5",
            ConfigInputType.Number,
            SubGroup: "Rate Limiting"
        ),
    };

    public static readonly IReadOnlyDictionary<string, ConfigDefinition> ByKey = All.ToDictionary(
        d => d.Key,
        StringComparer.OrdinalIgnoreCase
    );

    public static IEnumerable<ConfigDefinition> GetBySection(ConfigSection section) =>
        All.Where(d => d.Section == section);
}
