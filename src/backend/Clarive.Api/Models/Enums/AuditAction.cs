namespace Clarive.Api.Models.Enums;

public enum AuditAction
{
    EntryCreated,
    EntryPublished,
    EntryTrashed,
    EntryRestored,
    EntryDeleted,
    VersionPromoted,
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
    EntryDraftUpdated
}
