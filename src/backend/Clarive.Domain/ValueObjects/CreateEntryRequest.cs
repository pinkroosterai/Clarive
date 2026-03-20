using System.ComponentModel.DataAnnotations;

namespace Clarive.Domain.ValueObjects;

/// <summary>
/// Entry draft data. Persisted in AiSession.Draft (jsonb) and also used as the
/// API request DTO for entry creation. Validation attributes serve both the
/// endpoint validation layer (MiniValidation) and document field constraints.
/// </summary>
public record CreateEntryRequest(
    [property: Required(ErrorMessage = "Title is required.")]
    [property: StringLength(500, ErrorMessage = "Title must be 500 characters or fewer.")]
        string Title,
    string? SystemMessage,
    [property: Required(ErrorMessage = "At least one prompt is required.")]
    [property: MinLength(1, ErrorMessage = "At least one prompt is required.")]
        List<PromptInput> Prompts,
    Guid? FolderId
);

/// <summary>
/// A single prompt content block within a CreateEntryRequest.
/// Persisted as part of AiSession.Draft (jsonb).
/// </summary>
public record PromptInput(string Content, bool IsTemplate = false);
