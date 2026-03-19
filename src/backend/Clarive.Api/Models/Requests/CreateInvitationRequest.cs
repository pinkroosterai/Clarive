using System.ComponentModel.DataAnnotations;

namespace Clarive.Api.Models.Requests;

public record CreateInvitationRequest(
    [property: Required(ErrorMessage = "Email is required.")]
    [property: EmailAddress(ErrorMessage = "Invalid email format.")]
        string Email,
    string Role
);
