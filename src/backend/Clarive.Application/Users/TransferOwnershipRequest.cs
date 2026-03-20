namespace Clarive.Application.Users;

public record TransferOwnershipRequest(Guid TargetUserId, string Confirmation);
