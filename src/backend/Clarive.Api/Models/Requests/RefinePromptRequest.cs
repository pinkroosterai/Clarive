namespace Clarive.Api.Models.Requests;

public record RefinePromptRequest(
    Guid SessionId,
    List<AnsweredQuestionInput>? Answers = null,
    List<int>? SelectedEnhancements = null
);
