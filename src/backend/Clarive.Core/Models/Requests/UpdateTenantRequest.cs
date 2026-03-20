using System.ComponentModel.DataAnnotations;

namespace Clarive.Core.Models.Requests;

public record UpdateTenantRequest(
    [property: Required(ErrorMessage = "Name is required.")]
    [property: StringLength(255, ErrorMessage = "Name must be 255 characters or fewer.")]
        string Name
);
