using Clarive.Api.Models.Entities;

namespace Clarive.Api.Models.Responses;

public record PaginatedAuditLog(List<AuditLogEntry> Entries, int Total, int Page, int PageSize);
