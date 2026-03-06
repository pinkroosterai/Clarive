using System.ComponentModel;

namespace Clarive.Api.Models.Agents;

/// <summary>
/// Structured output returned by the generation agent.
/// </summary>
public class PromptSet
{
    [Description("A concise, descriptive title for the prompt entry (max 100 chars)")]
    public string Title { get; set; } = "";

    [Description("System message defining the LLM's role and persona. Null unless system message generation was requested.")]
    public string? SystemMessage { get; set; }

    [Description("The ordered list of prompt messages")]
    public List<PromptMessage> Prompts { get; set; } = [];
}
