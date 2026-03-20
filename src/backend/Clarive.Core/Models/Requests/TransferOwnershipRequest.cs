namespace Clarive.Core.Models.Requests;

public record TransferOwnershipRequest(Guid TargetUserId, string Confirmation);
