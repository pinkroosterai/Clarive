using System.ComponentModel.DataAnnotations;

namespace Clarive.Application.Variants.Contracts;

// ── Requests ──

public record CreateVariantRequest(
    [property: Required(ErrorMessage = "Variant name is required.")]
    [property: StringLength(100, MinimumLength = 1, ErrorMessage = "Variant name must be 1-100 characters.")]
        string Name,
    [property: Range(1, int.MaxValue, ErrorMessage = "Base version must be a positive integer.")]
        int BasedOnVersion
);

public record RenameVariantRequest(
    [property: Required(ErrorMessage = "New name is required.")]
    [property: StringLength(100, MinimumLength = 1, ErrorMessage = "Variant name must be 1-100 characters.")]
        string NewName
);

// ── Responses ──

public record VariantInfo(
    Guid Id,
    string Name,
    int BasedOnVersion,
    DateTime CreatedAt
);
