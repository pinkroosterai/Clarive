using System.ComponentModel.DataAnnotations;

namespace Clarive.Application.Tabs.Contracts;

// ── Requests ──

public record CreateTabRequest(
    [property: Required(ErrorMessage = "Tab name is required.")]
    [property: StringLength(100, MinimumLength = 1, ErrorMessage = "Tab name must be 1-100 characters.")]
        string Name,
    [property: Range(1, int.MaxValue, ErrorMessage = "Base version must be a positive integer.")]
        int ForkedFromVersion
);

public record RenameTabRequest(
    [property: Required(ErrorMessage = "New name is required.")]
    [property: StringLength(100, MinimumLength = 1, ErrorMessage = "Tab name must be 1-100 characters.")]
        string NewName
);

// ── Responses ──

public record TabInfo(
    Guid Id,
    string Name,
    int? ForkedFromVersion,
    bool IsMainTab,
    DateTime CreatedAt
);
