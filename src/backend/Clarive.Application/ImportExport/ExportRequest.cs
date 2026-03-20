namespace Clarive.Application.ImportExport;

public record ExportRequest(List<Guid>? FolderIds, List<Guid>? EntryIds);
