using Clarive.Infrastructure.Security;
using System.Security.Cryptography;
using System.Text;
using Clarive.Api.Helpers;
using Clarive.Application.ApiKeys.Services;
using Clarive.Domain.Entities;
using Clarive.Domain.Enums;
using Clarive.Domain.Interfaces.Repositories;

namespace Clarive.Api.Seed;

public static class SeedData
{
    // Deterministic GUIDs from string names — stable across restarts (not used for security)
#pragma warning disable CA5351 // MD5 is fine here — deterministic IDs, not cryptographic use
    private static Guid DeterministicGuid(string name) =>
        new(MD5.HashData(Encoding.UTF8.GetBytes(name)));
#pragma warning restore CA5351

    // Well-known IDs
    public static readonly Guid TenantId = DeterministicGuid("clarive-default-tenant");
    public static readonly Guid AdminUserId = DeterministicGuid("user-admin");
    public static readonly Guid EditorUserId = DeterministicGuid("user-editor");
    public static readonly Guid ViewerUserId = DeterministicGuid("user-viewer");

    // Folder IDs
    private static readonly Guid F001 = DeterministicGuid("folder-f-001");
    private static readonly Guid F002 = DeterministicGuid("folder-f-002");
    private static readonly Guid F003 = DeterministicGuid("folder-f-003");
    private static readonly Guid F004 = DeterministicGuid("folder-f-004");
    private static readonly Guid F005 = DeterministicGuid("folder-f-005");
    private static readonly Guid F006 = DeterministicGuid("folder-f-006");

    // Entry IDs
    private static readonly Guid E001 = DeterministicGuid("entry-e-001");
    private static readonly Guid E002 = DeterministicGuid("entry-e-002");
    private static readonly Guid E003 = DeterministicGuid("entry-e-003");
    private static readonly Guid E004 = DeterministicGuid("entry-e-004");
    private static readonly Guid E005 = DeterministicGuid("entry-e-005");
    private static readonly Guid E006 = DeterministicGuid("entry-e-006");
    private static readonly Guid E007 = DeterministicGuid("entry-e-007");
    private static readonly Guid E008 = DeterministicGuid("entry-e-008");
    private static readonly Guid E009 = DeterministicGuid("entry-e-009");
    private static readonly Guid E010 = DeterministicGuid("entry-e-010");

    // Tool IDs
    private static readonly Guid T001 = DeterministicGuid("tool-t-001");
    private static readonly Guid T002 = DeterministicGuid("tool-t-002");
    private static readonly Guid T003 = DeterministicGuid("tool-t-003");
    private static readonly Guid T004 = DeterministicGuid("tool-t-004");

    // API Key IDs
    private static readonly Guid AK001 = DeterministicGuid("apikey-ak-001");
    private static readonly Guid AK002 = DeterministicGuid("apikey-ak-002");

    // Well-known API keys for testing
    public const string TestApiKey1 = "cl_seed_test_key_for_seed_a3f8";
    public const string TestApiKey2 = "cl_dev_test_key_for_seed_7b21";

    public static async Task InitializeAsync(IServiceProvider services)
    {
        using var scope = services.CreateScope();
        var sp = scope.ServiceProvider;

        var tenantRepo = sp.GetRequiredService<ITenantRepository>();
        var userRepo = sp.GetRequiredService<IUserRepository>();
        var membershipRepo = sp.GetRequiredService<ITenantMembershipRepository>();
        var folderRepo = sp.GetRequiredService<IFolderRepository>();
        var entryRepo = sp.GetRequiredService<IEntryRepository>();
        var toolRepo = sp.GetRequiredService<IToolRepository>();
        var apiKeyRepo = sp.GetRequiredService<IApiKeyRepository>();
        var auditLogRepo = sp.GetRequiredService<IAuditLogRepository>();
        var passwordHasher = sp.GetRequiredService<PasswordHasher>();

        // Skip if already seeded
        if (await tenantRepo.GetByIdAsync(TenantId) is not null)
            return;

        await SeedTenantAsync(tenantRepo);
        await SeedUsersAsync(userRepo, passwordHasher);
        await SeedMembershipsAsync(membershipRepo, tenantRepo);
        await SeedFoldersAsync(folderRepo);
        await SeedEntriesAsync(entryRepo);
        await SeedToolsAsync(toolRepo);
        await SeedApiKeysAsync(apiKeyRepo);
        await SeedAuditLogAsync(auditLogRepo);
    }

    private static async Task SeedTenantAsync(ITenantRepository tenantRepo)
    {
        await tenantRepo.CreateAsync(
            new Tenant
            {
                Id = TenantId,
                Name = "Clarive Demo",
                CreatedAt = DateTime.Parse("2025-08-01T00:00:00Z").ToUniversalTime(),
            }
        );
    }

    private static async Task SeedUsersAsync(
        IUserRepository userRepo,
        PasswordHasher passwordHasher
    )
    {
        var hash = passwordHasher.Hash("password");

        await userRepo.CreateAsync(
            new User
            {
                Id = AdminUserId,
                TenantId = TenantId,
                Email = "admin@clarive.dev",
                Name = "Admin User",
                PasswordHash = hash,
                Role = UserRole.Admin,
                EmailVerified = true,
                OnboardingCompleted = true,
                IsSuperUser = true,
                CreatedAt = DateTime.Parse("2025-08-01T00:00:00Z").ToUniversalTime(),
            }
        );

        await userRepo.CreateAsync(
            new User
            {
                Id = EditorUserId,
                TenantId = TenantId,
                Email = "jane@clarive.dev",
                Name = "Jane Editor",
                PasswordHash = hash,
                Role = UserRole.Editor,
                EmailVerified = true,
                OnboardingCompleted = true,
                CreatedAt = DateTime.Parse("2025-08-15T00:00:00Z").ToUniversalTime(),
            }
        );

        await userRepo.CreateAsync(
            new User
            {
                Id = ViewerUserId,
                TenantId = TenantId,
                Email = "sam@clarive.dev",
                Name = "Sam Viewer",
                PasswordHash = hash,
                Role = UserRole.Viewer,
                EmailVerified = true,
                OnboardingCompleted = true,
                CreatedAt = DateTime.Parse("2025-09-01T00:00:00Z").ToUniversalTime(),
            }
        );
    }

    private static async Task SeedMembershipsAsync(
        ITenantMembershipRepository membershipRepo,
        ITenantRepository tenantRepo
    )
    {
        var baseDate = DateTime.Parse("2025-08-01T00:00:00Z").ToUniversalTime();

        await membershipRepo.CreateAsync(
            new TenantMembership
            {
                Id = DeterministicGuid("membership-admin"),
                UserId = AdminUserId,
                TenantId = TenantId,
                Role = UserRole.Admin,
                IsPersonal = true,
                JoinedAt = baseDate,
            }
        );

        await membershipRepo.CreateAsync(
            new TenantMembership
            {
                Id = DeterministicGuid("membership-editor"),
                UserId = EditorUserId,
                TenantId = TenantId,
                Role = UserRole.Editor,
                IsPersonal = false,
                JoinedAt = DateTime.Parse("2025-08-15T00:00:00Z").ToUniversalTime(),
            }
        );

        await membershipRepo.CreateAsync(
            new TenantMembership
            {
                Id = DeterministicGuid("membership-viewer"),
                UserId = ViewerUserId,
                TenantId = TenantId,
                Role = UserRole.Viewer,
                IsPersonal = false,
                JoinedAt = DateTime.Parse("2025-09-01T00:00:00Z").ToUniversalTime(),
            }
        );

        // Set tenant owner
        var tenant = await tenantRepo.GetByIdAsync(TenantId);
        if (tenant is not null)
        {
            tenant.OwnerId = AdminUserId;
            await tenantRepo.UpdateAsync(tenant);
        }
    }

    private static async Task SeedFoldersAsync(IFolderRepository folderRepo)
    {
        async Task F(Guid id, string name, Guid? parentId) =>
            await folderRepo.CreateAsync(
                new Folder
                {
                    Id = id,
                    TenantId = TenantId,
                    Name = name,
                    ParentId = parentId,
                    CreatedAt = DateTime.Parse("2025-08-01T00:00:00Z").ToUniversalTime(),
                }
            );

        await F(F001, "Content Writing", null);
        await F(F002, "Code Review", null);
        await F(F003, "Data Analysis", null);
        await F(F004, "Blog Posts", F001);
        await F(F005, "Security Audits", F002);
        await F(F006, "Technical Blogs", F004);
    }

    private record SeedEntryOptions(
        Guid EntryId,
        string Title,
        Guid? FolderId,
        string? SystemMessage,
        List<(string Content, bool IsTemplate)> PromptInputs,
        int CurrentVersion,
        VersionState State,
        bool IsTrashed,
        Guid CreatedBy,
        string CreatedAt,
        string UpdatedAt,
        int HistoricalVersions = 0
    );

    private static async Task SeedEntriesAsync(IEntryRepository entryRepo)
    {
        var entries = new SeedEntryOptions[]
        {
            // e-001: Blog Post Generator — published v2, template, in Content Writing
            new(
                E001,
                "Blog Post Generator",
                F001,
                "You are a professional content writer specializing in technology blogs.",
                [
                    (
                        "Write a {{tone}} blog post about {{topic}} targeting a {{audience}} audience. The post should be approximately {{wordCount}} words long.",
                        true
                    ),
                ],
                CurrentVersion: 2,
                State: VersionState.Published,
                IsTrashed: false,
                CreatedBy: AdminUserId,
                CreatedAt: "2025-11-10T09:00:00Z",
                UpdatedAt: "2026-01-15T14:30:00Z",
                HistoricalVersions: 1
            ),
            // e-002: Code Review Pipeline — published v3, chain, in Code Review
            new(
                E002,
                "Code Review Pipeline",
                F002,
                "You are a senior software engineer performing thorough code reviews.",
                [
                    (
                        "Analyze the following code for potential bugs, logic errors, and edge cases that are not handled:\n\n```\n{{code}}\n```",
                        false
                    ),
                    (
                        "Now review the same code for security vulnerabilities, including injection risks, authentication issues, and data exposure.",
                        false
                    ),
                    (
                        "Finally, suggest performance optimizations and refactoring opportunities. Prioritize by impact.",
                        false
                    ),
                ],
                CurrentVersion: 3,
                State: VersionState.Published,
                IsTrashed: false,
                CreatedBy: EditorUserId,
                CreatedAt: "2025-10-05T11:00:00Z",
                UpdatedAt: "2026-01-20T10:00:00Z",
                HistoricalVersions: 2
            ),
            // e-003: CSV Data Summarizer — draft v1, in Data Analysis
            new(
                E003,
                "CSV Data Summarizer",
                F003,
                "You are a data analyst who excels at extracting insights from raw data.",
                [
                    (
                        "Given the following CSV data, provide a concise summary including key trends, outliers, and actionable insights:\n\n{{csvData}}",
                        false
                    ),
                ],
                CurrentVersion: 1,
                State: VersionState.Tab,
                IsTrashed: false,
                CreatedBy: AdminUserId,
                CreatedAt: "2026-02-01T08:00:00Z",
                UpdatedAt: "2026-02-01T08:00:00Z"
            ),
            // e-004: Technical Tutorial Writer — published v1, template, in Technical Blogs
            new(
                E004,
                "Technical Tutorial Writer",
                F006,
                "You are an experienced technical writer creating step-by-step tutorials.",
                [
                    (
                        "Write a step-by-step tutorial on {{subject}} for {{skillLevel}} developers. Include code examples in {{language}} and explain each step clearly.",
                        true
                    ),
                ],
                CurrentVersion: 1,
                State: VersionState.Published,
                IsTrashed: false,
                CreatedBy: EditorUserId,
                CreatedAt: "2025-12-20T10:00:00Z",
                UpdatedAt: "2026-01-05T16:45:00Z"
            ),
            // e-005: Sales Report Analyzer — published v4, chain, in Data Analysis
            new(
                E005,
                "Sales Report Analyzer",
                F003,
                "You are a business intelligence analyst.",
                [
                    (
                        "Parse the following sales data and identify the top 5 performing products by revenue:\n\n{{salesData}}",
                        false
                    ),
                    (
                        "Based on the top performers identified, analyze seasonal trends and predict next quarter's performance.",
                        false
                    ),
                    (
                        "Generate an executive summary with 3 key recommendations for the sales team.",
                        false
                    ),
                    (
                        "Format the complete analysis as a markdown report with charts described in text.",
                        false
                    ),
                ],
                CurrentVersion: 4,
                State: VersionState.Published,
                IsTrashed: false,
                CreatedBy: AdminUserId,
                CreatedAt: "2025-09-15T13:00:00Z",
                UpdatedAt: "2026-02-10T09:15:00Z",
                HistoricalVersions: 3
            ),
            // e-006: Meeting Notes Formatter — draft v1, root level
            new(
                E006,
                "Meeting Notes Formatter",
                null,
                null,
                [
                    (
                        "Take the following raw meeting notes and format them into a structured document with: attendees, key decisions, action items with owners, and follow-up dates.\n\nRaw notes:\n{{notes}}",
                        false
                    ),
                ],
                CurrentVersion: 1,
                State: VersionState.Tab,
                IsTrashed: false,
                CreatedBy: EditorUserId,
                CreatedAt: "2026-02-15T11:00:00Z",
                UpdatedAt: "2026-02-15T11:00:00Z"
            ),
            // e-007: OWASP Security Checker — published v2, in Security Audits
            new(
                E007,
                "OWASP Security Checker",
                F005,
                "You are a cybersecurity expert specializing in application security.",
                [
                    (
                        "Review the following code against the OWASP Top 10 vulnerabilities. For each applicable vulnerability, explain the risk, show the problematic code, and provide the corrected version.\n\n```\n{{code}}\n```",
                        false
                    ),
                ],
                CurrentVersion: 2,
                State: VersionState.Published,
                IsTrashed: false,
                CreatedBy: AdminUserId,
                CreatedAt: "2025-11-01T09:30:00Z",
                UpdatedAt: "2026-01-25T15:00:00Z",
                HistoricalVersions: 1
            ),
            // e-008: Email Tone Adjuster — published v1, root level
            new(
                E008,
                "Email Tone Adjuster",
                null,
                "You are a professional communications specialist.",
                [
                    (
                        "Rewrite the following email to be more {{desiredTone}} while preserving the core message and all factual information:\n\n{{emailContent}}",
                        false
                    ),
                ],
                CurrentVersion: 1,
                State: VersionState.Published,
                IsTrashed: false,
                CreatedBy: EditorUserId,
                CreatedAt: "2026-01-10T14:00:00Z",
                UpdatedAt: "2026-01-10T14:00:00Z"
            ),
            // e-009: Deprecated: Basic Summarizer — trashed, published v1
            new(
                E009,
                "Deprecated: Basic Summarizer",
                F001,
                null,
                [("Summarize the following text in 3 sentences:\n\n{{text}}", false)],
                CurrentVersion: 1,
                State: VersionState.Published,
                IsTrashed: true,
                CreatedBy: AdminUserId,
                CreatedAt: "2025-08-20T10:00:00Z",
                UpdatedAt: "2026-02-05T12:00:00Z"
            ),
            // e-010: SEO Meta Description Generator — published v3, in Blog Posts
            new(
                E010,
                "SEO Meta Description Generator",
                F004,
                "You are an SEO specialist who writes compelling meta descriptions.",
                [
                    (
                        "Generate 3 meta description options (max 155 characters each) for a page about {{pageTitle}}. Focus on click-through rate and include a call to action.",
                        false
                    ),
                ],
                CurrentVersion: 3,
                State: VersionState.Published,
                IsTrashed: false,
                CreatedBy: EditorUserId,
                CreatedAt: "2025-10-15T08:00:00Z",
                UpdatedAt: "2026-02-12T11:30:00Z",
                HistoricalVersions: 2
            ),
        };

        foreach (var opts in entries)
            await SeedEntryAsync(entryRepo, opts);
    }

    private static async Task SeedEntryAsync(IEntryRepository entryRepo, SeedEntryOptions opts)
    {
        var created = DateTime.Parse(opts.CreatedAt).ToUniversalTime();
        var updated = DateTime.Parse(opts.UpdatedAt).ToUniversalTime();

        await entryRepo.CreateAsync(
            new PromptEntry
            {
                Id = opts.EntryId,
                TenantId = TenantId,
                Title = opts.Title,
                FolderId = opts.FolderId,
                IsTrashed = opts.IsTrashed,
                CreatedBy = opts.CreatedBy,
                CreatedAt = created,
                UpdatedAt = updated,
            }
        );

        // Create historical versions
        for (int v = 1; v <= opts.HistoricalVersions; v++)
        {
            await entryRepo.CreateVersionAsync(
                new PromptEntryVersion
                {
                    Id = DeterministicGuid($"version-{opts.EntryId}-v{v}"),
                    EntryId = opts.EntryId,
                    Version = v,
                    VersionState = VersionState.Historical,
                    SystemMessage = opts.SystemMessage,
                    Prompts = BuildSeedPrompts(opts.EntryId, v, opts.PromptInputs),
                    PublishedAt = created.AddDays(v * 7),
                    PublishedBy = opts.CreatedBy,
                    CreatedAt = created.AddDays((v - 1) * 7),
                }
            );
        }

        // Create current version
        await entryRepo.CreateVersionAsync(
            new PromptEntryVersion
            {
                Id = DeterministicGuid($"version-{opts.EntryId}-v{opts.CurrentVersion}"),
                EntryId = opts.EntryId,
                Version = opts.State == VersionState.Tab ? 0 : opts.CurrentVersion,
                VersionState = opts.State,
                TabName = opts.State == VersionState.Tab ? "Main" : null,
                IsMainTab = opts.State == VersionState.Tab,
                SystemMessage = opts.SystemMessage,
                Prompts = BuildSeedPrompts(opts.EntryId, opts.CurrentVersion, opts.PromptInputs),
                PublishedAt = opts.State == VersionState.Published ? updated : null,
                PublishedBy = opts.State == VersionState.Published ? opts.CreatedBy : null,
                CreatedAt =
                    opts.HistoricalVersions > 0
                        ? created.AddDays(opts.HistoricalVersions * 7)
                        : created,
            }
        );
    }

    private static List<Prompt> BuildSeedPrompts(
        Guid entryId,
        int version,
        List<(string Content, bool IsTemplate)> inputs
    )
    {
        return inputs
            .Select(
                (pi, i) =>
                {
                    var fields = TemplateParser.Parse(pi.Content);
                    return new Prompt
                    {
                        Id = DeterministicGuid($"prompt-{entryId}-v{version}-{i}"),
                        Content = pi.Content,
                        Order = i,
                        IsTemplate = pi.IsTemplate || fields.Count > 0,
                        TemplateFields = fields,
                    };
                }
            )
            .ToList();
    }

    private static async Task SeedToolsAsync(IToolRepository toolRepo)
    {
        await toolRepo.CreateAsync(
            new ToolDescription
            {
                Id = T001,
                TenantId = TenantId,
                Name = "Web Search",
                ToolName = "web_search",
                Description =
                    "Searches the web for current information and returns relevant results with snippets and URLs.",
                CreatedAt = DateTime.Parse("2025-10-01T00:00:00Z").ToUniversalTime(),
            }
        );
        await toolRepo.CreateAsync(
            new ToolDescription
            {
                Id = T002,
                TenantId = TenantId,
                Name = "Code Executor",
                ToolName = "run_code",
                Description =
                    "Executes code in a sandboxed environment and returns stdout, stderr, and the exit code.",
                CreatedAt = DateTime.Parse("2025-10-01T00:00:00Z").ToUniversalTime(),
            }
        );
        await toolRepo.CreateAsync(
            new ToolDescription
            {
                Id = T003,
                TenantId = TenantId,
                Name = "File Reader",
                ToolName = "read_file",
                Description =
                    "Reads the contents of a file from the user's workspace given a relative file path.",
                CreatedAt = DateTime.Parse("2025-10-01T00:00:00Z").ToUniversalTime(),
            }
        );
        await toolRepo.CreateAsync(
            new ToolDescription
            {
                Id = T004,
                TenantId = TenantId,
                Name = "Database Query",
                ToolName = "query_db",
                Description =
                    "Executes a read-only SQL query against the connected database and returns the result set as JSON.",
                CreatedAt = DateTime.Parse("2026-01-05T08:00:00Z").ToUniversalTime(),
            }
        );
    }

    private static async Task SeedApiKeysAsync(IApiKeyRepository apiKeyRepo)
    {
        await apiKeyRepo.CreateAsync(
            new ApiKey
            {
                Id = AK001,
                TenantId = TenantId,
                Name = "Production API Key",
                KeyHash = ApiKeyService.HashKey(TestApiKey1),
                KeyPrefix = "cl_seed••••••••••••a3f8",
                CreatedAt = DateTime.Parse("2025-12-01T10:00:00Z").ToUniversalTime(),
            }
        );
        await apiKeyRepo.CreateAsync(
            new ApiKey
            {
                Id = AK002,
                TenantId = TenantId,
                Name = "Development API Key",
                KeyHash = ApiKeyService.HashKey(TestApiKey2),
                KeyPrefix = "cl_dev_••••••••••••7b21",
                CreatedAt = DateTime.Parse("2026-01-20T15:30:00Z").ToUniversalTime(),
            }
        );
    }

    private static async Task SeedAuditLogAsync(IAuditLogRepository auditLogRepo)
    {
        async Task A(
            string id,
            AuditAction action,
            string entityType,
            Guid entityId,
            Guid userId,
            string userName,
            string timestamp,
            string details
        )
        {
            await auditLogRepo.AddAsync(
                new AuditLogEntry
                {
                    Id = DeterministicGuid($"audit-{id}"),
                    TenantId = TenantId,
                    Action = action,
                    EntityType = entityType,
                    EntityId = entityId,
                    EntityTitle = details,
                    UserId = userId,
                    UserName = userName,
                    Timestamp = DateTime.Parse(timestamp).ToUniversalTime(),
                    Details = details,
                    ExpiresAt = DateTime.Parse(timestamp).ToUniversalTime().AddDays(30),
                }
            );
        }

        await A(
            "al-001",
            AuditAction.EntryCreated,
            "prompt_entry",
            E001,
            AdminUserId,
            "Admin User",
            "2025-11-10T09:00:00Z",
            "Created 'Blog Post Generator'"
        );
        await A(
            "al-002",
            AuditAction.EntryPublished,
            "prompt_entry",
            E001,
            AdminUserId,
            "Admin User",
            "2025-11-12T14:00:00Z",
            "Published version 1"
        );
        await A(
            "al-003",
            AuditAction.EntryCreated,
            "prompt_entry",
            E002,
            EditorUserId,
            "Jane Editor",
            "2025-10-05T11:00:00Z",
            "Created 'Code Review Pipeline'"
        );
        await A(
            "al-004",
            AuditAction.EntryPublished,
            "prompt_entry",
            E002,
            EditorUserId,
            "Jane Editor",
            "2025-10-10T09:30:00Z",
            "Published version 1"
        );
        await A(
            "al-005",
            AuditAction.EntryCreated,
            "prompt_entry",
            E005,
            AdminUserId,
            "Admin User",
            "2026-02-10T09:15:00Z",
            "Updated prompts in 'Sales Report Analyzer'"
        );
        await A(
            "al-006",
            AuditAction.EntryTrashed,
            "prompt_entry",
            E009,
            AdminUserId,
            "Admin User",
            "2026-02-05T12:00:00Z",
            "Moved 'Deprecated: Basic Summarizer' to trash"
        );
        await A(
            "al-007",
            AuditAction.EntryCreated,
            "folder",
            F006,
            EditorUserId,
            "Jane Editor",
            "2025-12-18T10:00:00Z",
            "Created folder 'Technical Blogs'"
        );
        await A(
            "al-008",
            AuditAction.EntryCreated,
            "api_key",
            AK001,
            AdminUserId,
            "Admin User",
            "2025-12-01T10:00:00Z",
            "Created 'Production API Key'"
        );
        await A(
            "al-009",
            AuditAction.EntryPublished,
            "prompt_entry",
            E010,
            EditorUserId,
            "Jane Editor",
            "2026-02-12T11:30:00Z",
            "Published version 3 of 'SEO Meta Description Generator'"
        );
        await A(
            "al-010",
            AuditAction.EntryCreated,
            "tool_description",
            T004,
            AdminUserId,
            "Admin User",
            "2026-01-05T08:00:00Z",
            "Added 'Database Query' tool description"
        );
    }
}
