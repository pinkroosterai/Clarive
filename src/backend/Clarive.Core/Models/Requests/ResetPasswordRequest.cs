namespace Clarive.Core.Models.Requests;

public record ResetPasswordRequest(string Token, string NewPassword);
