namespace Clarive.Domain.Entities;

public class JobExecutionHistory
{
    public Guid Id { get; set; }
    public string JobName { get; set; } = "";
    public string JobGroup { get; set; } = "";
    public string TriggerName { get; set; } = "";
    public DateTime FireTimeUtc { get; set; }
    public DateTime StartedAtUtc { get; set; }
    public DateTime? FinishedAtUtc { get; set; }
    public long? DurationMs { get; set; }
    public bool Succeeded { get; set; }
    public string? ExceptionMessage { get; set; }
    public string? ExceptionStackTrace { get; set; }
}
