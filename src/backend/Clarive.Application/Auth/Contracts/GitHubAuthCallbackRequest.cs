namespace Clarive.Application.Auth.Contracts;

public record GitHubAuthCallbackRequest(string Code, string State);
