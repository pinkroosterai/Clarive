using Clarive.Api.Models.Entities;

namespace Clarive.Api.Models.Results;

public record TransferOwnershipResult(User PreviousAdmin, User NewAdmin);
