using System.ComponentModel.DataAnnotations;

namespace Clarive.Api.Models.Requests;

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

public record PromptInput(string Content, bool IsTemplate = false);
