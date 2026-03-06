namespace Clarive.Api.Models.Agents;

/// <summary>
/// A question-answer pair used for passing user clarifications to agents.
/// </summary>
public record AnsweredQuestion(string Question, string Answer);
