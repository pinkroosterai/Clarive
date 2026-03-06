using Clarive.Api.Models.Requests;
using Clarive.Api.Models.Responses;

namespace Clarive.Api.Models.Results;

public record AiGenerationResult(
    Guid SessionId,
    CreateEntryRequest Draft,
    List<ClarificationQuestionDto> Questions,
    List<string> Enhancements,
    EvaluationDto? Evaluation,
    List<IterationScoreDto> ScoreHistory);
