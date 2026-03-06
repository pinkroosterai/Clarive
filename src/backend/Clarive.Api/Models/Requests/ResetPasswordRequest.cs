namespace Clarive.Api.Models.Requests;

public record ResetPasswordRequest(string Token, string NewPassword);
