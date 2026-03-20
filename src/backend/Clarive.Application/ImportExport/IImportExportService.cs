using Clarive.Domain.ValueObjects;

namespace Clarive.Application.ImportExport;

public interface IImportExportService
{
    /// <summary>
    /// Exports entries matching the request criteria as a YAML byte array.
    /// Returns the bytes, content type, and suggested file name.
    /// </summary>
    Task<ExportFileResult> ExportAsync(
        Guid tenantId,
        ExportRequest? request,
        CancellationToken ct = default
    );

    /// <summary>
    /// Imports entries from a parsed YAML entry list into the workspace.
    /// The caller is responsible for parsing the uploaded file.
    /// </summary>
    Task<ImportResponse> ImportAsync(
        Guid tenantId,
        Guid userId,
        List<object> entryList,
        CancellationToken ct = default
    );
}

public record ExportFileResult(byte[] Bytes, string ContentType, string FileName);
