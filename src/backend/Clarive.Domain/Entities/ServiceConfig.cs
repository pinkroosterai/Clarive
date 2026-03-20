namespace Clarive.Domain.Entities;

public class ServiceConfig
{
    public string Key { get; set; } = "";
    public string? EncryptedValue { get; set; }
    public bool IsEncrypted { get; set; }
    public DateTime UpdatedAt { get; set; }
    public string? UpdatedBy { get; set; }
}
