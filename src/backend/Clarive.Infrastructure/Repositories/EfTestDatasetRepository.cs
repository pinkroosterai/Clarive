using Clarive.Domain.Entities;
using Clarive.Domain.Interfaces.Repositories;
using Clarive.Infrastructure.Data;
using Microsoft.EntityFrameworkCore;

namespace Clarive.Infrastructure.Repositories;

public class EfTestDatasetRepository(ClariveDbContext db) : ITestDatasetRepository
{
    public async Task<TestDataset?> GetByIdAsync(Guid tenantId, Guid id, CancellationToken ct = default)
    {
        return await db.TestDatasets
            .AsNoTracking()
            .Include(d => d.Rows)
            .Where(d => d.TenantId == tenantId && d.Id == id)
            .FirstOrDefaultAsync(ct);
    }

    public async Task<List<TestDataset>> GetByEntryIdAsync(Guid tenantId, Guid entryId, CancellationToken ct = default)
    {
        return await db.TestDatasets
            .AsNoTracking()
            .Where(d => d.TenantId == tenantId && d.EntryId == entryId)
            .OrderByDescending(d => d.UpdatedAt)
            .ToListAsync(ct);
    }

    public async Task<int> GetCountByEntryIdAsync(Guid tenantId, Guid entryId, CancellationToken ct = default)
    {
        return await db.TestDatasets
            .Where(d => d.TenantId == tenantId && d.EntryId == entryId)
            .CountAsync(ct);
    }

    public async Task<TestDataset> CreateAsync(TestDataset dataset, CancellationToken ct = default)
    {
        db.TestDatasets.Add(dataset);
        await db.SaveChangesAsync(ct);
        return dataset;
    }

    public async Task<TestDataset> UpdateAsync(TestDataset dataset, CancellationToken ct = default)
    {
        await db.TestDatasets
            .Where(d => d.Id == dataset.Id)
            .ExecuteUpdateAsync(s => s
                .SetProperty(d => d.Name, dataset.Name)
                .SetProperty(d => d.UpdatedAt, dataset.UpdatedAt), ct);
        return dataset;
    }

    public async Task TouchUpdatedAtAsync(Guid datasetId, CancellationToken ct = default)
    {
        await db.TestDatasets
            .Where(d => d.Id == datasetId)
            .ExecuteUpdateAsync(s => s.SetProperty(d => d.UpdatedAt, DateTime.UtcNow), ct);
    }

    public async Task<bool> DeleteAsync(Guid tenantId, Guid id, CancellationToken ct = default)
    {
        var dataset = await db.TestDatasets
            .Where(d => d.TenantId == tenantId && d.Id == id)
            .FirstOrDefaultAsync(ct);

        if (dataset is null)
            return false;

        db.TestDatasets.Remove(dataset);
        await db.SaveChangesAsync(ct);
        return true;
    }

    // Row operations

    public async Task<TestDatasetRow> AddRowAsync(TestDatasetRow row, CancellationToken ct = default)
    {
        db.TestDatasetRows.Add(row);
        await db.SaveChangesAsync(ct);
        return row;
    }

    public async Task<List<TestDatasetRow>> AddRowsAsync(List<TestDatasetRow> rows, CancellationToken ct = default)
    {
        db.TestDatasetRows.AddRange(rows);
        await db.SaveChangesAsync(ct);
        return rows;
    }

    public async Task<TestDatasetRow> UpdateRowAsync(TestDatasetRow row, CancellationToken ct = default)
    {
        var entry = db.Entry(row);
        if (entry.State == Microsoft.EntityFrameworkCore.EntityState.Detached)
            db.TestDatasetRows.Attach(row);
        entry.State = Microsoft.EntityFrameworkCore.EntityState.Modified;
        await db.SaveChangesAsync(ct);
        return row;
    }

    public async Task<bool> DeleteRowAsync(Guid datasetId, Guid rowId, CancellationToken ct = default)
    {
        var row = await db.TestDatasetRows
            .Where(r => r.DatasetId == datasetId && r.Id == rowId)
            .FirstOrDefaultAsync(ct);

        if (row is null)
            return false;

        db.TestDatasetRows.Remove(row);
        await db.SaveChangesAsync(ct);
        return true;
    }

    public async Task<List<TestDatasetRow>> GetRowsByDatasetIdAsync(Guid datasetId, CancellationToken ct = default)
    {
        return await db.TestDatasetRows
            .AsNoTracking()
            .Where(r => r.DatasetId == datasetId)
            .OrderBy(r => r.CreatedAt)
            .ToListAsync(ct);
    }
}
