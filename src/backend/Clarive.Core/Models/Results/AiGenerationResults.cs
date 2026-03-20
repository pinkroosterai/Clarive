using Clarive.Core.Models.Requests;
using Clarive.Domain.ValueObjects;
using Clarive.Core.Models.Responses;

namespace Clarive.Core.Models.Results;

public record AiGenerationResult(
    Guid SessionId,
    CreateEntryRequest Draft,
    List<ClarificationQuestionDto> Questions,
    List<string> Enhancements,
    EvaluationDto? Evaluation,
    List<IterationScoreDto> ScoreHistory
);
