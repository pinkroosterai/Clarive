namespace Clarive.Application.Auth.Contracts;

public record ResetPasswordRequest(string Token, string NewPassword);
