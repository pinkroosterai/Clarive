using Clarive.AI.Models;
namespace Clarive.Application.AiGeneration.Contracts;

public record RefinePromptRequest(
    Guid SessionId,
    List<AnsweredQuestionInput>? Answers = null,
    List<int>? SelectedEnhancements = null
);
