namespace Clarive.Api.Services.Agents;

public enum AiProviderErrorCategory
{
    RateLimited,
    Unavailable,
    Timeout
}

public class AiProviderException : Exception
{
    public AiProviderErrorCategory Category { get; }
    public string ProviderName { get; }
    public int AttemptsMade { get; }
    public int? RetryAfterSeconds { get; }

    public AiProviderException(
        AiProviderErrorCategory category,
        string providerName,
        int attemptsMade,
        int? retryAfterSeconds,
        string message,
        Exception? innerException = null)
        : base(message, innerException)
    {
        Category = category;
        ProviderName = providerName;
        AttemptsMade = attemptsMade;
        RetryAfterSeconds = retryAfterSeconds;
    }
}
