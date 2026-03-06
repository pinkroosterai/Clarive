namespace Clarive.Api.Models.Requests;

public record ValidateAiConfigRequest(string? ApiKey = null, string? EndpointUrl = null);

public record GetAiModelsRequest(string? ApiKey = null, string? EndpointUrl = null);
