using ErrorOr;

namespace Clarive.Application.TestDatasets.Contracts;

public interface ITestDatasetService
{
    Task<ErrorOr<List<TestDatasetResponse>>> ListAsync(
        Guid tenantId, Guid entryId, CancellationToken ct = default);

    Task<ErrorOr<TestDatasetDetailResponse>> GetAsync(
        Guid tenantId, Guid entryId, Guid datasetId, CancellationToken ct = default);

    Task<ErrorOr<TestDatasetDetailResponse>> CreateAsync(
        Guid tenantId, Guid entryId, CreateTestDatasetRequest request, CancellationToken ct = default);

    Task<ErrorOr<TestDatasetDetailResponse>> UpdateAsync(
        Guid tenantId, Guid entryId, Guid datasetId, UpdateTestDatasetRequest request, CancellationToken ct = default);

    Task<ErrorOr<bool>> DeleteAsync(
        Guid tenantId, Guid entryId, Guid datasetId, CancellationToken ct = default);

    // Row operations
    Task<ErrorOr<TestDatasetRowResponse>> AddRowAsync(
        Guid tenantId, Guid entryId, Guid datasetId, AddTestDatasetRowRequest request, CancellationToken ct = default);

    Task<ErrorOr<TestDatasetRowResponse>> UpdateRowAsync(
        Guid tenantId, Guid entryId, Guid datasetId, Guid rowId, UpdateTestDatasetRowRequest request, CancellationToken ct = default);

    Task<ErrorOr<bool>> DeleteRowAsync(
        Guid tenantId, Guid entryId, Guid datasetId, Guid rowId, CancellationToken ct = default);

    // AI generation
    Task<ErrorOr<List<TestDatasetRowResponse>>> GenerateRowsAsync(
        Guid tenantId, Guid entryId, Guid datasetId, GenerateTestDatasetRowsRequest request, CancellationToken ct = default);
}
