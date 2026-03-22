using System.Text.Json;
using System.Text.RegularExpressions;
using Clarive.Application.Entries.Contracts;
using Clarive.Domain.Errors;
using Clarive.Domain.Interfaces.Repositories;
using ErrorOr;

namespace Clarive.Application.Entries.Services;

public partial class EntryActivityService(
    IEntryRepository entryRepo,
    IAuditLogRepository auditRepo
) : IEntryActivityService
{
    [GeneratedRegex(@"v(?:ersion\s+)?(\d+)")]
    private static partial Regex VersionPattern();

    public async Task<ErrorOr<EntryActivityResponse>> GetEntryActivityAsync(
        Guid tenantId,
        Guid entryId,
        int page,
        int pageSize,
        CancellationToken ct
    )
    {
        var entry = await entryRepo.GetByIdAsync(tenantId, entryId, ct);
        if (entry is null)
            return DomainErrors.EntryNotFound;

        var (entries, total) = await auditRepo.GetByEntityIdAsync(
            tenantId,
            entryId,
            page,
            pageSize,
            ct
        );

        var items = entries
            .Select(a =>
            {
                int? version = null;
                if (a.Details is not null)
                {
                    var match = VersionPattern().Match(a.Details);
                    if (match.Success && int.TryParse(match.Groups[1].Value, out var v))
                        version = v;
                }

                return new EntryActivityItem(
                    a.Id,
                    JsonNamingPolicy.SnakeCaseLower.ConvertName(a.Action.ToString()),
                    a.UserName,
                    a.Details,
                    version,
                    a.Timestamp
                );
            })
            .ToList();

        return new EntryActivityResponse(items, total, page, pageSize);
    }
}
