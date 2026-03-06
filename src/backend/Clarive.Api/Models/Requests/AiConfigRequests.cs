namespace Clarive.Api.Models.Requests;

public record ValidateAiConfigRequest(string ApiKey, string? EndpointUrl);

public record GetAiModelsRequest(string? ApiKey = null, string? EndpointUrl = null);
