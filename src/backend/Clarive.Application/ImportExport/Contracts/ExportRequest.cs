namespace Clarive.Application.ImportExport.Contracts;

public record ExportRequest(List<Guid>? FolderIds, List<Guid>? EntryIds);
