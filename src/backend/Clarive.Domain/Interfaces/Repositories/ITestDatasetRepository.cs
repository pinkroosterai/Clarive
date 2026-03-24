using Clarive.Domain.Entities;

namespace Clarive.Domain.Interfaces.Repositories;

public interface ITestDatasetRepository
{
    Task<TestDataset?> GetByIdAsync(Guid tenantId, Guid id, CancellationToken ct = default);
    Task<List<TestDataset>> GetByEntryIdAsync(Guid tenantId, Guid entryId, CancellationToken ct = default);
    Task<int> GetCountByEntryIdAsync(Guid tenantId, Guid entryId, CancellationToken ct = default);
    Task<TestDataset> CreateAsync(TestDataset dataset, CancellationToken ct = default);
    Task<TestDataset> UpdateAsync(TestDataset dataset, CancellationToken ct = default);
    Task<bool> DeleteAsync(Guid tenantId, Guid id, CancellationToken ct = default);
    Task TouchUpdatedAtAsync(Guid datasetId, CancellationToken ct = default);

    // Row operations
    Task<TestDatasetRow> AddRowAsync(TestDatasetRow row, CancellationToken ct = default);
    Task<List<TestDatasetRow>> AddRowsAsync(List<TestDatasetRow> rows, CancellationToken ct = default);
    Task<TestDatasetRow> UpdateRowAsync(TestDatasetRow row, CancellationToken ct = default);
    Task<bool> DeleteRowAsync(Guid datasetId, Guid rowId, CancellationToken ct = default);
    Task<List<TestDatasetRow>> GetRowsByDatasetIdAsync(Guid datasetId, CancellationToken ct = default);
    Task<Dictionary<Guid, int>> GetRowCountsByDatasetIdsAsync(List<Guid> datasetIds, CancellationToken ct = default);
}
