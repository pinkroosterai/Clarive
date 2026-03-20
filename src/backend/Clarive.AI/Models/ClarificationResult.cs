using Clarive.Domain.ValueObjects;
using System.ComponentModel;

namespace Clarive.AI.Models;

/// <summary>
/// Result from the clarification agent (pre-gen or post-gen).
/// </summary>
public class ClarificationResult
{
    [Description("Clarification questions about ambiguities in the user's intent")]
    public List<ClarificationQuestion> Questions { get; set; } = [];

    [Description("Specific enhancement suggestions")]
    public List<string> Enhancements { get; set; } = [];
}
