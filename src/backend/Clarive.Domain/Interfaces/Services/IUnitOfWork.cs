namespace Clarive.Domain.Interfaces.Services;

public interface IUnitOfWork
{
    Task<T> ExecuteInTransactionAsync<T>(
        Func<Task<T>> operation,
        CancellationToken ct = default
    );

    Task ExecuteInTransactionAsync(
        Func<Task> operation,
        CancellationToken ct = default
    );
}
