using ErrorOr;

namespace Clarive.Domain.Errors;

public static class DomainErrors
{
    // ── Entry ──

    public static Error EntryNotFound => Error.NotFound("ENTRY_NOT_FOUND", "Entry not found.");

    public static Error VersionNotFound => Error.NotFound("VERSION_NOT_FOUND", "No version found.");

    public static Error VersionNotFoundForEntry =>
        Error.NotFound("VERSION_NOT_FOUND", "No version found for this entry.");

    public static Error HistoricalVersionNotFound =>
        Error.NotFound("VERSION_NOT_FOUND", "Historical version not found.");

    public static Error NoPublishedVersion =>
        Error.NotFound("NO_PUBLISHED_VERSION", "This entry has no published version.");

    public static Error NoWorkingVersion =>
        Error.NotFound("NO_VERSION", "Entry has no working version.");

    // ── Folder ──

    public static Error FolderNotFound => Error.NotFound("FOLDER_NOT_FOUND", "Folder not found.");

    public static Error ParentFolderNotFound =>
        Error.NotFound("FOLDER_NOT_FOUND", "Parent folder not found.");

    public static Error TargetFolderNotFound =>
        Error.NotFound("FOLDER_NOT_FOUND", "Target folder not found.");

    public static Error TargetParentFolderNotFound =>
        Error.NotFound("FOLDER_NOT_FOUND", "Target parent folder not found.");

    // ── User ──

    public static Error UserNotFound => Error.NotFound("USER_NOT_FOUND", "User not found.");

    public static Error TargetUserNotFound =>
        Error.NotFound("TARGET_NOT_FOUND", "Target user not found.");

    public static Error CurrentUserNotFound =>
        Error.NotFound("CURRENT_NOT_FOUND", "Current user not found.");

    public static Error MembershipNotFound =>
        Error.NotFound("MEMBERSHIP_NOT_FOUND", "User membership not found for this workspace.");

    // ── AI Provider ──

    public static Error ProviderNotFound => Error.NotFound("PROVIDER_NOT_FOUND", "Provider not found.");

    public static Error AiModelNotFound => Error.NotFound("MODEL_NOT_FOUND", "Model not found.");

    // ── Share Link ──

    public static Error ShareLinkNotFound =>
        Error.NotFound("SHARE_LINK_NOT_FOUND", "No active share link found for this entry.");

    public static Error ShareLinkNotFoundForEntry =>
        Error.NotFound("SHARE_LINK_NOT_FOUND", "No share link found for this entry.");

    public static Error ShareLinkNotFoundOrInactive =>
        Error.NotFound("SHARE_LINK_NOT_FOUND", "Share link not found or inactive.");

    public static Error SharedEntryNotFound =>
        Error.NotFound("ENTRY_NOT_FOUND", "The shared entry is no longer available.");

    public static Error SharedVersionNotFound =>
        Error.NotFound("VERSION_NOT_FOUND", "The shared version is no longer available.");

    // ── Session ──

    public static Error SessionNotFound =>
        Error.NotFound("SESSION_NOT_FOUND", "Session not found or expired.");

    // ── Invitation ──

    public static Error InvitationNotFound =>
        Error.NotFound("INVITATION_NOT_FOUND", "Invitation not found or expired.");

    // ── Test Dataset ──

    public static Error TestDatasetNotFound =>
        Error.NotFound("TEST_DATASET_NOT_FOUND", "Test dataset not found.");

    public static Error TestDatasetRowNotFound =>
        Error.NotFound("TEST_DATASET_ROW_NOT_FOUND", "Test dataset row not found.");

    public static Error TestDatasetLimitExceeded =>
        Error.Validation("TEST_DATASET_LIMIT_EXCEEDED", "Maximum 20 test datasets per entry.");

    public static Error TestDatasetRowLimitExceeded =>
        Error.Validation("TEST_DATASET_ROW_LIMIT_EXCEEDED", "Maximum 1000 rows per dataset.");

    public static Error TestDatasetRowValuesInvalid =>
        Error.Validation("TEST_DATASET_ROW_VALUES_INVALID", "Row values exceed size limits (max 50 keys, 100 chars per key, 10000 chars per value).");

    // ── A/B Test ──

    public static Error AbTestRunNotFound =>
        Error.NotFound("AB_TEST_NOT_FOUND", "A/B test run not found.");

    public static Error AbTestDatasetEmpty =>
        Error.Validation("AB_TEST_DATASET_EMPTY", "Test dataset has no rows.");

    public static Error AbTestVersionNotFound =>
        Error.NotFound("AB_TEST_VERSION_NOT_FOUND", "One or both versions not found for this entry.");

    // ── Tabs ──

    public static Error TabNotFound =>
        Error.NotFound("TAB_NOT_FOUND", "Tab not found.");

    public static Error DuplicateTabName =>
        Error.Conflict("DUPLICATE_TAB_NAME", "A tab with this name already exists for this entry.");

    public static Error MaxTabsExceeded =>
        Error.Validation("MAX_TABS_EXCEEDED", "Maximum 20 tabs per entry.");

    public static Error TabNameRequired =>
        Error.Validation("TAB_NAME_REQUIRED", "Tab name is required.");

    public static Error CannotDeleteMainTab =>
        Error.Validation("CANNOT_DELETE_MAIN_TAB", "The Main tab cannot be deleted.");
}
