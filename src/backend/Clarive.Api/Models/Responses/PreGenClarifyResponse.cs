namespace Clarive.Api.Models.Responses;

public record PreGenClarifyResponse(
    Guid SessionId,
    List<ClarificationQuestionDto> Questions,
    List<string> Enhancements
);

public record ClarificationQuestionDto(
    string Text,
    List<string> Suggestions
);
