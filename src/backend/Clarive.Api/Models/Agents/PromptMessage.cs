using System.ComponentModel;

namespace Clarive.Api.Models.Agents;

/// <summary>
/// A single prompt message within a PromptSet.
/// </summary>
public class PromptMessage
{
    [Description("The prompt content text")]
    public string Content { get; set; } = "";

    [Description("True if the prompt contains {{name|type}} template variables")]
    public bool IsTemplate { get; set; }
}
