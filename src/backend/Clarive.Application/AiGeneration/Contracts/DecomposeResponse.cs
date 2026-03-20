using Clarive.Domain.ValueObjects;

namespace Clarive.Application.AiGeneration.Contracts;

public record DecomposeResponse(List<PromptInput> Prompts);
