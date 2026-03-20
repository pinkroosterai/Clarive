using Clarive.Domain.ValueObjects;

namespace Clarive.Application.AiGeneration;

public record AiGenerationResult(
    Guid SessionId,
    CreateEntryRequest Draft,
    List<ClarificationQuestionDto> Questions,
    List<string> Enhancements,
    EvaluationDto? Evaluation,
    List<IterationScoreDto> ScoreHistory
);
