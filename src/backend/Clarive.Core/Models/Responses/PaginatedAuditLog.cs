using Clarive.Domain.Entities;

namespace Clarive.Core.Models.Responses;

public record PaginatedAuditLog(List<AuditLogEntry> Entries, int Total, int Page, int PageSize);
