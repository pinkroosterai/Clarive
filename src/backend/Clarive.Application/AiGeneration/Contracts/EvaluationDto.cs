namespace Clarive.Application.AiGeneration.Contracts;

public record EvaluationDto(Dictionary<string, EvaluationEntryDto> Dimensions);

public record EvaluationEntryDto(int Score, string Feedback);

public record IterationScoreDto(
    int Iteration,
    Dictionary<string, EvaluationEntryDto> Scores,
    double AverageScore
);
