using Clarive.Domain.Entities;

namespace Clarive.Application.Audit;

public record PaginatedAuditLog(List<AuditLogEntry> Entries, int Total, int Page, int PageSize);
