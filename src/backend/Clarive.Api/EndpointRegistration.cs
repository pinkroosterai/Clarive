using Clarive.Api.Endpoints;
using Clarive.Api.Hubs;

namespace Clarive.Api;

public static class EndpointRegistration
{
    public static WebApplication MapClariveHubs(this WebApplication app)
    {
        app.MapHub<PresenceHub>("/api/hubs/presence").RequireAuthorization();
        return app;
    }

    public static WebApplication MapClariveEndpoints(this WebApplication app)
    {
        app.MapAuthEndpoints();
        app.MapFolderEndpoints();
        app.MapEntryEndpoints();
        app.MapToolEndpoints();
        app.MapMcpServerEndpoints();
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
