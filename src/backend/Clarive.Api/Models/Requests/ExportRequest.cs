namespace Clarive.Api.Models.Requests;

public record ExportRequest(
    List<Guid>? FolderIds,
    List<Guid>? EntryIds
);
