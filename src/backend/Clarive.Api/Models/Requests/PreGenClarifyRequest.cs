namespace Clarive.Api.Models.Requests;

public record PreGenClarifyRequest(
    string Description,
    bool GenerateSystemMessage = false,
    bool GenerateTemplate = false,
    bool GenerateChain = false,
    List<Guid>? ToolIds = null,
    bool EnableWebSearch = false
);
