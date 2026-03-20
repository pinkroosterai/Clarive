using Clarive.Domain.Entities;

namespace Clarive.Application.Users;

public record TransferOwnershipResult(User PreviousAdmin, User NewAdmin);
