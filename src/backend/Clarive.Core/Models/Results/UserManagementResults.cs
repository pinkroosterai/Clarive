using Clarive.Domain.Entities;

namespace Clarive.Core.Models.Results;

public record TransferOwnershipResult(User PreviousAdmin, User NewAdmin);
