using Clarive.Domain.Enums;

namespace Clarive.AI.Services;

public record ActionAiConfig
{
    public string Model { get; init; } = "";
    public string ProviderId { get; init; } = "";
    public float? Temperature { get; init; }
    public int? MaxTokens { get; init; }
    public string? ReasoningEffort { get; init; }
}

public record AiSettings
{
    // Per-action model configuration
    public ActionAiConfig Generation { get; init; } = new();
    public ActionAiConfig Evaluation { get; init; } = new();
    public ActionAiConfig Clarification { get; init; } = new();
    public ActionAiConfig SystemMessage { get; init; } = new();
    public ActionAiConfig Decomposition { get; init; } = new();
    public ActionAiConfig FillTemplateFields { get; init; } = new();
    public ActionAiConfig PlaygroundJudge { get; init; } = new();
    public ActionAiConfig PolishDescription { get; init; } = new();

    // Playground & tools
    public string AllowedModels { get; init; } = "";
    public string TavilyApiKey { get; init; } = "";

    public ActionAiConfig? GetActionConfig(AiActionType actionType) =>
        actionType switch
        {
            AiActionType.Generation => Generation,
            AiActionType.Evaluation => Evaluation,
            AiActionType.Clarification => Clarification,
            AiActionType.SystemMessage => SystemMessage,
            AiActionType.Decomposition => Decomposition,
            AiActionType.FillTemplateFields => FillTemplateFields,
            AiActionType.PlaygroundJudge => PlaygroundJudge,
            AiActionType.PolishDescription => PolishDescription,
            _ => null,
        };
}
