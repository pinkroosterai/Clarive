namespace Clarive.Application.ShareLinks.Contracts;

public record CreateShareLinkRequest(
    DateTime? ExpiresAt = null,
    string? Password = null,
    int? PinnedVersion = null
);

public record VerifySharePasswordRequest(string Password);
