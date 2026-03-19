using Clarive.Api.Models.Requests;

namespace Clarive.Api.Models.Responses;

public record GeneratePromptResponse(
    Guid SessionId,
    CreateEntryRequest Draft,
    List<ClarificationQuestionDto> Questions,
    List<string> Enhancements,
    EvaluationDto? Evaluation = null,
    List<IterationScoreDto>? ScoreHistory = null
);

public record ClarificationQuestionDto(string Text, List<string> Suggestions);
