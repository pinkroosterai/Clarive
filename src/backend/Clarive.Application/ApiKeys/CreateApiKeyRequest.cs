using System.ComponentModel.DataAnnotations;

namespace Clarive.Application.ApiKeys;

public record CreateApiKeyRequest(
    [property: Required(ErrorMessage = "Name is required.")]
    [property: StringLength(100, ErrorMessage = "Name must be 100 characters or fewer.")]
        string Name,
    DateTime? ExpiresAt = null
);
