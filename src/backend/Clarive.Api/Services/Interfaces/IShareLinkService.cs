using Clarive.Api.Models.Entities;
using ErrorOr;

namespace Clarive.Api.Services.Interfaces;

public record ShareLinkResult(string RawToken, ShareLink Link);
public record SharedEntryResult(
    Guid EntryId,
    string Title,
    string? SystemMessage,
    int Version,
    DateTime? PublishedAt,
    List<SharedPrompt> Prompts,
    bool PasswordRequired);
public record SharedPrompt(string Content, int Order, bool IsTemplate, List<TemplateField>? TemplateFields);

public interface IShareLinkService
{
    Task<ErrorOr<ShareLinkResult>> CreateAsync(
        Guid tenantId, Guid entryId, Guid userId,
        DateTime? expiresAt = null, string? password = null, int? pinnedVersion = null,
        CancellationToken ct = default);

    Task<ErrorOr<ShareLink>> GetByEntryIdAsync(Guid tenantId, Guid entryId, CancellationToken ct = default);

    Task<ErrorOr<Success>> RevokeAsync(Guid tenantId, Guid entryId, CancellationToken ct = default);

    Task<ErrorOr<SharedEntryResult>> GetPublicEntryByTokenAsync(string rawToken, CancellationToken ct = default);

    Task<ErrorOr<SharedEntryResult>> VerifyPasswordAndGetEntryAsync(string rawToken, string password, CancellationToken ct = default);
}
