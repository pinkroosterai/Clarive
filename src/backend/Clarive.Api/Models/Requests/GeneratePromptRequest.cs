namespace Clarive.Api.Models.Requests;

public record GeneratePromptRequest(
    string Description,
    bool GenerateSystemMessage = false,
    bool GenerateTemplate = false,
    bool GenerateChain = false,
    List<Guid>? ToolIds = null,
    Guid? SessionId = null,
    List<AnsweredQuestionInput>? PreGenAnswers = null,
    List<int>? SelectedEnhancements = null
);

public record AnsweredQuestionInput(int QuestionIndex, string Answer);
