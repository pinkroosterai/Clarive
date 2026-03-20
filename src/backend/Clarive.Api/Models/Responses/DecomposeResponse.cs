using Clarive.Api.Models.Requests;
using Clarive.Domain.ValueObjects;

namespace Clarive.Api.Models.Responses;

public record DecomposeResponse(List<PromptInput> Prompts);
