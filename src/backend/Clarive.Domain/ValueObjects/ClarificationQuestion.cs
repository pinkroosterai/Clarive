using System.ComponentModel;

namespace Clarive.Domain.ValueObjects;

/// <summary>
/// A single clarification question with suggested answers.
/// </summary>
public class ClarificationQuestion
{
    [Description("The clarification question text")]
    public string Text { get; set; } = "";

    [Description("2-4 concrete suggested answers")]
    public List<string> Suggestions { get; set; } = [];
}
