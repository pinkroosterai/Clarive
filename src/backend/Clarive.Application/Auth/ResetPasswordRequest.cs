namespace Clarive.Application.Auth;

public record ResetPasswordRequest(string Token, string NewPassword);
