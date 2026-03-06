namespace Clarive.Api.Models.Responses;

public record ValidateAiConfigResponse(bool Valid, string? Error = null);

public record GetAiModelsResponse(List<string> Models);
