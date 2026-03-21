using Clarive.Domain.ValueObjects;
using System.ComponentModel.DataAnnotations;

namespace Clarive.Application.Entries.Contracts;

public record UpdateEntryRequest(
    [property: StringLength(500, ErrorMessage = "Title must be 500 characters or fewer.")]
        string? Title,
    string? SystemMessage,
    List<PromptInput>? Prompts,
    Dictionary<string, PromptEvaluationEntry>? Evaluation = null
);
