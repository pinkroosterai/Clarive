namespace Clarive.Api.Models.Requests;

public record TransferOwnershipRequest(Guid TargetUserId, string Confirmation);
