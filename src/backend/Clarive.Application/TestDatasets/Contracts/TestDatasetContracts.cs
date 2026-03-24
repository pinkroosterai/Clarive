using System.ComponentModel.DataAnnotations;

namespace Clarive.Application.TestDatasets.Contracts;

// ── Requests ──

public record CreateTestDatasetRequest(
    [property: Required(ErrorMessage = "Name is required.")]
    [property: StringLength(100, MinimumLength = 1, ErrorMessage = "Name must be between 1 and 100 characters.")]
        string Name
);

public record UpdateTestDatasetRequest(
    [property: Required(ErrorMessage = "Name is required.")]
    [property: StringLength(100, MinimumLength = 1, ErrorMessage = "Name must be between 1 and 100 characters.")]
        string Name
);

public record AddTestDatasetRowRequest(
    [property: Required(ErrorMessage = "Values are required.")]
        Dictionary<string, string> Values
);

public record UpdateTestDatasetRowRequest(
    [property: Required(ErrorMessage = "Values are required.")]
        Dictionary<string, string> Values
);

public record GenerateTestDatasetRowsRequest(
    [property: Range(1, 20, ErrorMessage = "Count must be between 1 and 20.")]
        int Count = 5
);

// ── Responses ──

public record TestDatasetResponse(
    Guid Id,
    string Name,
    int RowCount,
    DateTime CreatedAt,
    DateTime UpdatedAt
);

public record TestDatasetDetailResponse(
    Guid Id,
    string Name,
    List<TestDatasetRowResponse> Rows,
    DateTime CreatedAt,
    DateTime UpdatedAt
);

public record TestDatasetRowResponse(
    Guid Id,
    Dictionary<string, string> Values,
    DateTime CreatedAt
);
