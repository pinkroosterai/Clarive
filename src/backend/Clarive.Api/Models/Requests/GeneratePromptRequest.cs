namespace Clarive.Api.Models.Requests;

public record GeneratePromptRequest(
    string Description,
    bool GenerateSystemMessage = false,
    bool GenerateTemplate = false,
    bool GenerateChain = false,
    List<Guid>? ToolIds = null,
    bool EnableWebSearch = false
);

public record AnsweredQuestionInput(int QuestionIndex, string Answer);
