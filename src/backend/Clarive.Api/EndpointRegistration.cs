using Clarive.Api.Endpoints;

namespace Clarive.Api;

public static class EndpointRegistration
{
    public static WebApplication MapClariveEndpoints(this WebApplication app)
    {
        app.MapAuthEndpoints();
        app.MapFolderEndpoints();
        app.MapEntryEndpoints();
        app.MapToolEndpoints();
        app.MapApiKeyEndpoints();
        app.MapUserEndpoints();
        app.MapInvitationEndpoints();
        app.MapTenantEndpoints();
        app.MapWorkspaceEndpoints();
        app.MapAuditLogEndpoints();
        app.MapPublicApiEndpoints();
        app.MapImportExportEndpoints();
        app.MapAiGenerationEndpoints();
        app.MapAccountEndpoints();
        app.MapProfileEndpoints();
        app.MapDashboardEndpoints();
        app.MapTagEndpoints();
        app.MapSuperEndpoints();
        app.MapConfigEndpoints();
        app.MapPlaygroundEndpoints();
        app.MapAiProviderEndpoints();
        app.MapAiUsageEndpoints();
        app.MapShareLinkEndpoints();
        app.MapPublicShareEndpoints();
        app.MapSystemLogEndpoints();

        return app;
    }
}
