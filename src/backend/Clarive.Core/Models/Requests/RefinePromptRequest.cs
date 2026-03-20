using Clarive.AI.Models;
namespace Clarive.Core.Models.Requests;

public record RefinePromptRequest(
    Guid SessionId,
    List<AnsweredQuestionInput>? Answers = null,
    List<int>? SelectedEnhancements = null
);
