using Clarive.Domain.ValueObjects;

namespace Clarive.Application.AiGeneration;

public record DecomposeResponse(List<PromptInput> Prompts);
