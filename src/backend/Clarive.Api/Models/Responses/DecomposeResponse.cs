using Clarive.Api.Models.Requests;

namespace Clarive.Api.Models.Responses;

public record DecomposeResponse(List<PromptInput> Prompts);
