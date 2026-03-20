using Clarive.AI.Models;
using System.ComponentModel.DataAnnotations;

namespace Clarive.Core.Models.Requests;

public record GeneratePromptRequest(
    [property: Required(ErrorMessage = "Description is required.")]
    [property: StringLength(2000, ErrorMessage = "Description must not exceed 2000 characters.")]
        string Description,
    bool GenerateSystemMessage = false,
    bool GenerateTemplate = false,
    bool GenerateChain = false,
    List<Guid>? ToolIds = null,
    bool EnableWebSearch = false
);

public record AnsweredQuestionInput(int QuestionIndex, string Answer);
