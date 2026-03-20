using Microsoft.EntityFrameworkCore.Infrastructure;

namespace Clarive.Application.Common;

public static class TransactionExtensions
{
    public static async Task<T> InTransactionAsync<T>(
        this DatabaseFacade database,
        Func<Task<T>> operation,
        CancellationToken ct
    )
    {
        await using var tx = await database.BeginTransactionAsync(ct);
        var result = await operation();
        await tx.CommitAsync(ct);
        return result;
    }

    public static async Task InTransactionAsync(
        this DatabaseFacade database,
        Func<Task> operation,
        CancellationToken ct
    )
    {
        await using var tx = await database.BeginTransactionAsync(ct);
        await operation();
        await tx.CommitAsync(ct);
    }
}
