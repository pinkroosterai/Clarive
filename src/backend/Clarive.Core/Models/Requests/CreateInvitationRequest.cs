using System.ComponentModel.DataAnnotations;

namespace Clarive.Core.Models.Requests;

public record CreateInvitationRequest(
    [property: Required(ErrorMessage = "Email is required.")]
    [property: EmailAddress(ErrorMessage = "Invalid email format.")]
        string Email,
    string Role
);
