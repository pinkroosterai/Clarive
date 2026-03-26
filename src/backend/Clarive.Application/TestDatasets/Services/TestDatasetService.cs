using Clarive.AI.Orchestration;
using Clarive.AI.Prompts;
using Clarive.Application.Common;
using Clarive.Application.TestDatasets.Contracts;
using Clarive.Domain.Entities;
using Clarive.Domain.Errors;
using Clarive.Domain.Interfaces.Repositories;
using Clarive.Domain.ValueObjects;
using ErrorOr;
using Microsoft.Extensions.Logging;

namespace Clarive.Application.TestDatasets.Services;

public class TestDatasetService(
    ITestDatasetRepository datasetRepo,
    IEntryRepository entryRepo,
    IPromptOrchestrator orchestrator,
    ILogger<TestDatasetService> logger
) : ITestDatasetService
{
    private const int MaxDatasetsPerEntry = 20;
    private const int MaxRowsPerDataset = 1000;
    private const int MaxRowKeys = 50;
    private const int MaxKeyLength = 100;
    private const int MaxValueLength = 10_000;

    public async Task<ErrorOr<List<TestDatasetResponse>>> ListAsync(
        Guid tenantId, Guid entryId, CancellationToken ct = default)
    {
        var entry = await entryRepo.GetByIdAsync(tenantId, entryId, ct);
        if (entry is null)
            return DomainErrors.EntryNotFound;

        var datasets = await datasetRepo.GetByEntryIdAsync(tenantId, entryId, ct);

        var rowCounts = await datasetRepo.GetRowCountsByDatasetIdsAsync(
            datasets.Select(d => d.Id).ToList(), ct);

        return datasets.Select(d => new TestDatasetResponse(
            d.Id, d.Name, rowCounts.GetValueOrDefault(d.Id, 0), d.CreatedAt, d.UpdatedAt
        )).ToList();
    }

    public async Task<ErrorOr<TestDatasetDetailResponse>> GetAsync(
        Guid tenantId, Guid entryId, Guid datasetId, CancellationToken ct = default)
    {
        var dataset = await GetDatasetWithOwnershipCheckAsync(tenantId, entryId, datasetId, ct);
        if (dataset is null)
            return DomainErrors.TestDatasetNotFound;

        return ToDetailResponse(dataset);
    }

    public async Task<ErrorOr<TestDatasetDetailResponse>> CreateAsync(
        Guid tenantId, Guid entryId, CreateTestDatasetRequest request, CancellationToken ct = default)
    {
        var validationErr = Validator.ValidateAndGetError(request);
        if (validationErr is not null)
            return validationErr.Value;

        var entry = await entryRepo.GetByIdAsync(tenantId, entryId, ct);
        if (entry is null)
            return DomainErrors.EntryNotFound;

        var count = await datasetRepo.GetCountByEntryIdAsync(tenantId, entryId, ct);
        if (count >= MaxDatasetsPerEntry)
            return DomainErrors.TestDatasetLimitExceeded;

        var now = DateTime.UtcNow;
        var dataset = new TestDataset
        {
            Id = Guid.NewGuid(),
            TenantId = tenantId,
            EntryId = entryId,
            Name = request.Name.Trim(),
            CreatedAt = now,
            UpdatedAt = now,
        };

        await datasetRepo.CreateAsync(dataset, ct);
        logger.LogInformation("Test dataset created: {DatasetId} '{Name}' for entry {EntryId}", dataset.Id, dataset.Name, entryId);

        dataset.Rows = [];
        return ToDetailResponse(dataset);
    }

    public async Task<ErrorOr<TestDatasetDetailResponse>> UpdateAsync(
        Guid tenantId, Guid entryId, Guid datasetId, UpdateTestDatasetRequest request, CancellationToken ct = default)
    {
        var validationErr = Validator.ValidateAndGetError(request);
        if (validationErr is not null)
            return validationErr.Value;

        var dataset = await GetDatasetWithOwnershipCheckAsync(tenantId, entryId, datasetId, ct);
        if (dataset is null)
            return DomainErrors.TestDatasetNotFound;

        dataset.Name = request.Name.Trim();
        dataset.UpdatedAt = DateTime.UtcNow;

        await datasetRepo.UpdateAsync(dataset, ct);
        return ToDetailResponse(dataset);
    }

    public async Task<ErrorOr<bool>> DeleteAsync(
        Guid tenantId, Guid entryId, Guid datasetId, CancellationToken ct = default)
    {
        var dataset = await GetDatasetWithOwnershipCheckAsync(tenantId, entryId, datasetId, ct);
        if (dataset is null)
            return DomainErrors.TestDatasetNotFound;

        await datasetRepo.DeleteAsync(tenantId, datasetId, ct);
        return true;
    }

    // ── Row Operations ──

    public async Task<ErrorOr<TestDatasetRowResponse>> AddRowAsync(
        Guid tenantId, Guid entryId, Guid datasetId, AddTestDatasetRowRequest request, CancellationToken ct = default)
    {
        var dataset = await GetDatasetWithOwnershipCheckAsync(tenantId, entryId, datasetId, ct);
        if (dataset is null)
            return DomainErrors.TestDatasetNotFound;

        if (dataset.Rows.Count >= MaxRowsPerDataset)
            return DomainErrors.TestDatasetRowLimitExceeded;

        var valErr = ValidateRowValues(request.Values);
        if (valErr is not null)
            return valErr.Value;

        var row = new TestDatasetRow
        {
            Id = Guid.NewGuid(),
            DatasetId = datasetId,
            Values = request.Values,
            CreatedAt = DateTime.UtcNow,
        };

        await datasetRepo.AddRowAsync(row, ct);
        await datasetRepo.TouchUpdatedAtAsync(datasetId, ct);

        return new TestDatasetRowResponse(row.Id, row.Values, row.CreatedAt);
    }

    public async Task<ErrorOr<TestDatasetRowResponse>> UpdateRowAsync(
        Guid tenantId, Guid entryId, Guid datasetId, Guid rowId, UpdateTestDatasetRowRequest request, CancellationToken ct = default)
    {
        var dataset = await GetDatasetWithOwnershipCheckAsync(tenantId, entryId, datasetId, ct);
        if (dataset is null)
            return DomainErrors.TestDatasetNotFound;

        var valErr = ValidateRowValues(request.Values);
        if (valErr is not null)
            return valErr.Value;

        var row = dataset.Rows.FirstOrDefault(r => r.Id == rowId);
        if (row is null)
            return DomainErrors.TestDatasetRowNotFound;

        row.Values = request.Values;
        await datasetRepo.UpdateRowAsync(row, ct);
        await datasetRepo.TouchUpdatedAtAsync(datasetId, ct);

        return new TestDatasetRowResponse(row.Id, row.Values, row.CreatedAt);
    }

    public async Task<ErrorOr<bool>> DeleteRowAsync(
        Guid tenantId, Guid entryId, Guid datasetId, Guid rowId, CancellationToken ct = default)
    {
        var dataset = await GetDatasetWithOwnershipCheckAsync(tenantId, entryId, datasetId, ct);
        if (dataset is null)
            return DomainErrors.TestDatasetNotFound;

        var deleted = await datasetRepo.DeleteRowAsync(datasetId, rowId, ct);
        if (!deleted)
            return DomainErrors.TestDatasetRowNotFound;

        await datasetRepo.TouchUpdatedAtAsync(datasetId, ct);

        return true;
    }

    // ── AI Generation ──

    public async Task<ErrorOr<List<TestDatasetRowResponse>>> GenerateRowsAsync(
        Guid tenantId, Guid entryId, Guid datasetId, GenerateTestDatasetRowsRequest request, CancellationToken ct = default)
    {
        var validationErr = Validator.ValidateAndGetError(request);
        if (validationErr is not null)
            return validationErr.Value;

        var dataset = await GetDatasetWithOwnershipCheckAsync(tenantId, entryId, datasetId, ct);
        if (dataset is null)
            return DomainErrors.TestDatasetNotFound;

        if (dataset.Rows.Count + request.Count > MaxRowsPerDataset)
            return DomainErrors.TestDatasetRowLimitExceeded;

        // Get entry's template fields
        var working = await entryRepo.GetWorkingVersionAsync(tenantId, entryId, ct: ct);
        if (working is null)
            return DomainErrors.NoWorkingVersion;

        var prompts = working.Prompts.OrderBy(p => p.Order).ToList();
        var allFields = prompts
            .Where(p => p.IsTemplate)
            .SelectMany(p => p.TemplateFields)
            .DistinctBy(f => f.Name)
            .ToList();

        if (allFields.Count == 0)
            return Error.Validation("NO_TEMPLATE_FIELDS", "Entry has no template fields.");

        var fieldInfos = allFields
            .Select(f => new TemplateFieldInfo(
                f.Name,
                f.Type.ToString().ToLowerInvariant(),
                f.EnumValues,
                f.Min,
                f.Max,
                null
            ))
            .ToList();

        var promptInputs = prompts.Select(p => new PromptInput(p.Content, p.IsTemplate)).ToList();

        // Generate N value sets in parallel
        var tasks = Enumerable.Range(0, request.Count)
            .Select(_ => orchestrator.FillTemplateFieldsAsync(fieldInfos, promptInputs, working.SystemMessage, ct))
            .ToList();

        var results = await Task.WhenAll(tasks);

        // Deduplicate by serialized values and filter errors
        var existingKeys = dataset.Rows
            .Select(r => string.Join("|", r.Values.OrderBy(kv => kv.Key).Select(kv => $"{kv.Key}={kv.Value}")))
            .ToHashSet();

        var uniqueRows = new List<TestDatasetRow>();
        foreach (var result in results)
        {
            if (result.Value is null)
                continue;

            var key = string.Join("|", result.Value.OrderBy(kv => kv.Key).Select(kv => $"{kv.Key}={kv.Value}"));
            if (!existingKeys.Add(key))
                continue;

            uniqueRows.Add(new TestDatasetRow
            {
                Id = Guid.NewGuid(),
                DatasetId = datasetId,
                Values = result.Value,
                CreatedAt = DateTime.UtcNow,
            });
        }

        if (uniqueRows.Count > 0)
        {
            await datasetRepo.AddRowsAsync(uniqueRows, ct);
            await datasetRepo.TouchUpdatedAtAsync(datasetId, ct);
        }

        logger.LogInformation(
            "Generated {Count} rows for dataset {DatasetId} (requested {Requested})",
            uniqueRows.Count, datasetId, request.Count);

        return uniqueRows.Select(r => new TestDatasetRowResponse(r.Id, r.Values, r.CreatedAt)).ToList();
    }

    private static Error? ValidateRowValues(Dictionary<string, string> values)
    {
        if (values.Count > MaxRowKeys)
            return DomainErrors.TestDatasetRowValuesInvalid;

        foreach (var (key, value) in values)
        {
            if (key.Length > MaxKeyLength)
                return DomainErrors.TestDatasetRowValuesInvalid;
            if (value is not null && value.Length > MaxValueLength)
                return DomainErrors.TestDatasetRowValuesInvalid;
        }

        return null;
    }

    /// <summary>
    /// Fetches a dataset by ID and verifies it belongs to the specified entry.
    /// Returns null if the dataset doesn't exist or belongs to a different entry.
    /// </summary>
    private async Task<TestDataset?> GetDatasetWithOwnershipCheckAsync(
        Guid tenantId, Guid entryId, Guid datasetId, CancellationToken ct)
    {
        var dataset = await datasetRepo.GetByIdAsync(tenantId, datasetId, ct);
        if (dataset is null || dataset.EntryId != entryId)
            return null;
        return dataset;
    }

    private static TestDatasetDetailResponse ToDetailResponse(TestDataset dataset) =>
        new(
            dataset.Id,
            dataset.Name,
            dataset.Rows
                .OrderBy(r => r.CreatedAt)
                .Select(r => new TestDatasetRowResponse(r.Id, r.Values, r.CreatedAt))
                .ToList(),
            dataset.CreatedAt,
            dataset.UpdatedAt
        );
}
