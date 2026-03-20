using Clarive.Domain.Entities;

namespace Clarive.Application.Users.Contracts;

public record TransferOwnershipResult(User PreviousAdmin, User NewAdmin);
