namespace Clarive.Application.Users.Contracts;

public record TransferOwnershipRequest(Guid TargetUserId, string Confirmation);
