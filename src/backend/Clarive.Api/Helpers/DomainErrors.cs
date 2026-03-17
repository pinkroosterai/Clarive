using ErrorOr;

namespace Clarive.Api.Helpers;

public static class DomainErrors
{
    // ── Entry ──

    public static Error EntryNotFound =>
        Error.NotFound("NOT_FOUND", "Entry not found.");

    public static Error EntryNotFoundByCode =>
        Error.NotFound("ENTRY_NOT_FOUND", "Entry not found.");

    public static Error VersionNotFound =>
        Error.NotFound("NOT_FOUND", "No version found.");

    public static Error VersionNotFoundForEntry =>
        Error.NotFound("NOT_FOUND", "No version found for this entry.");

    public static Error HistoricalVersionNotFound =>
        Error.NotFound("NOT_FOUND", "Historical version not found.");

    public static Error NoPublishedVersion =>
        Error.NotFound("NO_PUBLISHED_VERSION", "This entry has no published version.");

    public static Error NoWorkingVersion =>
        Error.NotFound("NO_VERSION", "Entry has no working version.");

    // ── Folder ──

    public static Error FolderNotFound =>
        Error.NotFound("NOT_FOUND", "Folder not found.");

    public static Error ParentFolderNotFound =>
        Error.NotFound("NOT_FOUND", "Parent folder not found.");

    public static Error TargetFolderNotFound =>
        Error.NotFound("NOT_FOUND", "Target folder not found.");

    public static Error TargetParentFolderNotFound =>
        Error.NotFound("NOT_FOUND", "Target parent folder not found.");

    // ── User ──

    public static Error UserNotFound =>
        Error.NotFound("NOT_FOUND", "User not found.");

    public static Error TargetUserNotFound =>
        Error.NotFound("TARGET_NOT_FOUND", "Target user not found.");

    public static Error CurrentUserNotFound =>
        Error.NotFound("CURRENT_NOT_FOUND", "Current user not found.");

    public static Error MembershipNotFound =>
        Error.NotFound("MEMBERSHIP_NOT_FOUND", "User membership not found for this workspace.");

    // ── AI Provider ──

    public static Error ProviderNotFound =>
        Error.NotFound("NOT_FOUND", "Provider not found.");

    public static Error AiModelNotFound =>
        Error.NotFound("NOT_FOUND", "Model not found.");

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
        Error.NotFound("NOT_FOUND", "Session not found or expired.");

    // ── Invitation ──

    public static Error InvitationNotFound =>
        Error.NotFound("NOT_FOUND", "Invitation not found or expired.");
}
