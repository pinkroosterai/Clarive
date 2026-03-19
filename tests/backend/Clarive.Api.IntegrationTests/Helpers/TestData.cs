using System.Security.Cryptography;
using System.Text;

namespace Clarive.Api.IntegrationTests.Helpers;

/// <summary>
/// Mirrors SeedData.DeterministicGuid() for all well-known seed IDs,
/// plus factory methods for generating unique test data.
/// </summary>
public static class TestData
{
    // Mirror the seed's deterministic GUID algorithm
    private static Guid DeterministicGuid(string name) =>
        new(MD5.HashData(Encoding.UTF8.GetBytes(name)));

    // ── Tenant + Users ──
    public static readonly Guid TenantId = DeterministicGuid("clarive-default-tenant");
    public static readonly Guid AdminUserId = DeterministicGuid("user-admin");
    public static readonly Guid EditorUserId = DeterministicGuid("user-editor");
    public static readonly Guid ViewerUserId = DeterministicGuid("user-viewer");

    // ── Folders ──
    public static readonly Guid FolderContentWriting = DeterministicGuid("folder-f-001");
    public static readonly Guid FolderCodeReview = DeterministicGuid("folder-f-002");
    public static readonly Guid FolderDataAnalysis = DeterministicGuid("folder-f-003");
    public static readonly Guid FolderBlogPosts = DeterministicGuid("folder-f-004");
    public static readonly Guid FolderSecurityAudits = DeterministicGuid("folder-f-005");
    public static readonly Guid FolderTechnicalBlogs = DeterministicGuid("folder-f-006");

    // ── Entries ──
    public static readonly Guid EntryBlogPostGenerator = DeterministicGuid("entry-e-001");
    public static readonly Guid EntryCodeReviewPipeline = DeterministicGuid("entry-e-002");
    public static readonly Guid EntryCsvSummarizer = DeterministicGuid("entry-e-003"); // draft
    public static readonly Guid EntryTutorialWriter = DeterministicGuid("entry-e-004");
    public static readonly Guid EntrySalesAnalyzer = DeterministicGuid("entry-e-005");
    public static readonly Guid EntryMeetingNotes = DeterministicGuid("entry-e-006"); // draft, root
    public static readonly Guid EntryOwaspChecker = DeterministicGuid("entry-e-007");
    public static readonly Guid EntryEmailToneAdjuster = DeterministicGuid("entry-e-008");
    public static readonly Guid EntryDeprecatedSummarizer = DeterministicGuid("entry-e-009"); // trashed
    public static readonly Guid EntrySeoMetaGenerator = DeterministicGuid("entry-e-010");

    // ── API Keys ──
    public const string ApiKey1 = "cl_seed_test_key_for_seed_a3f8";
    public const string ApiKey2 = "cl_dev_test_key_for_seed_7b21";

    // ── Seed user credentials ──
    public const string AdminEmail = "admin@clarive.dev";
    public const string EditorEmail = "jane@clarive.dev";
    public const string ViewerEmail = "sam@clarive.dev";
    public const string SeedPassword = "password";

    // ── Factory methods for unique test data ──
    private static int _counter;

    public static string UniqueEmail() => $"test-{Guid.NewGuid():N}@clarive.dev";

    public static string UniqueFolderName() => $"Test Folder {Interlocked.Increment(ref _counter)}";

    public static string UniqueEntryTitle() => $"Test Entry {Interlocked.Increment(ref _counter)}";
}
