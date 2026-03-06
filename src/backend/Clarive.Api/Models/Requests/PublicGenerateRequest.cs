namespace Clarive.Api.Models.Requests;

public record PublicGenerateRequest(
    Dictionary<string, string> Fields
);
