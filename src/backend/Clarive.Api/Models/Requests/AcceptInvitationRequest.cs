using System.ComponentModel.DataAnnotations;

namespace Clarive.Api.Models.Requests;

public record AcceptInvitationRequest(
    [property: Required(ErrorMessage = "Name is required.")]
    [property: StringLength(255, ErrorMessage = "Name must be 255 characters or fewer.")]
    string Name,
    [property: Required(ErrorMessage = "Password is required.")]
    [property: MinLength(12, ErrorMessage = "Password must be at least 12 characters.")]
    string Password);
