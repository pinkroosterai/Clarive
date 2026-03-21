using System.ComponentModel.DataAnnotations;

namespace Clarive.Application.AiGeneration.Contracts;

public record EvaluationDto(Dictionary<string, EvaluationEntryDto> Dimensions);

public record EvaluationEntryDto(
    [property: Range(0, 10, ErrorMessage = "Score must be between 0 and 10.")]
        int Score,
    string Feedback
);

public record IterationScoreDto(
    int Iteration,
    Dictionary<string, EvaluationEntryDto> Scores,
    double AverageScore
);
