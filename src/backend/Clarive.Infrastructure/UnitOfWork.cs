using Clarive.Domain.Interfaces.Services;
using Clarive.Infrastructure.Data;

namespace Clarive.Infrastructure;

public class UnitOfWork(ClariveDbContext db) : IUnitOfWork
{
    public async Task<T> ExecuteInTransactionAsync<T>(
        Func<Task<T>> operation,
        CancellationToken ct
    )
    {
        await using var tx = await db.Database.BeginTransactionAsync(ct);
        var result = await operation();
        await tx.CommitAsync(ct);
        return result;
    }

    public async Task ExecuteInTransactionAsync(
        Func<Task> operation,
        CancellationToken ct
    )
    {
        await using var tx = await db.Database.BeginTransactionAsync(ct);
        await operation();
        await tx.CommitAsync(ct);
    }
}
