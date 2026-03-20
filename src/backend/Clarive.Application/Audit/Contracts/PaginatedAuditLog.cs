using Clarive.Domain.Entities;

namespace Clarive.Application.Audit.Contracts;

public record PaginatedAuditLog(List<AuditLogEntry> Entries, int Total, int Page, int PageSize);
