using Clarive.Core.Models.Requests;
using Clarive.Domain.ValueObjects;

namespace Clarive.Core.Models.Responses;

public record DecomposeResponse(List<PromptInput> Prompts);
