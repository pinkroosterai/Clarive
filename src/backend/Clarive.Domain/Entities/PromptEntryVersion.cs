using System.Text.Json.Serialization;
using Clarive.Domain.Enums;
using Clarive.Domain.ValueObjects;

namespace Clarive.Domain.Entities;

public class PromptEntryVersion
{
    public Guid Id { get; set; }
    public Guid EntryId { get; set; }
    public int Version { get; set; }
    public VersionState VersionState { get; set; }
    public string? SystemMessage { get; set; }
    public List<Prompt> Prompts { get; set; } = [];
    public DateTime? PublishedAt { get; set; }
    public Guid? PublishedBy { get; set; }
    public DateTime CreatedAt { get; set; }

    // Quality evaluation (persisted as JSONB)
    public Dictionary<string, PromptEvaluationEntry>? Evaluation { get; set; }
    public double? EvaluationAverageScore { get; set; }
    public DateTime? EvaluatedAt { get; set; }

    // Concurrency token (PostgreSQL xmin system column)
    [JsonIgnore]
    public uint RowVersion { get; set; }

    // Navigation (excluded from JSON serialization to avoid cycles)
    [JsonIgnore]
    public PromptEntry Entry { get; set; } = null!;
}
