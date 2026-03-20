namespace Clarive.Domain.Enums;

public enum AuditAction
{
    EntryCreated,
    EntryPublished,
    EntryTrashed,
    EntryRestored,
    EntryDeleted,
    VersionPromoted,
    DraftDeleted,
    ApiGet,
    ApiGenerate,
    UserInvited,
    InvitationRevoked,
    InvitationAccepted,
    UserRoleChanged,
    UserDeleted,
    OwnershipTransferred,
    MemberAdded,
    MemberRemoved,
    InvitationDeclined,
    WorkspaceSwitched,
    MaintenanceEnabled,
    MaintenanceDisabled,
    EntryDraftUpdated,
}
