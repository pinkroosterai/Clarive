using System.ComponentModel.DataAnnotations;

namespace Clarive.Application.AiGeneration.Contracts;

public record EvaluateEntryRequest(
    string? SystemMessage,
    [property: Required(ErrorMessage = "At least one prompt is required.")]
    [property: MinLength(1, ErrorMessage = "At least one prompt is required.")]
        List<PromptContentItem> Prompts,
    string? Description = null
);

public record PromptContentItem(
    [property: Required(ErrorMessage = "Prompt content is required.")]
    [property: StringLength(100000, ErrorMessage = "Prompt content must not exceed 100,000 characters.")]
        string Content,
    int SortOrder = 0
);
