namespace Clarive.Domain.Entities;

public class SystemConfig
{
    public int Id { get; set; }
    public bool MaintenanceEnabled { get; set; }
    public DateTime? MaintenanceSince { get; set; }
    public string? MaintenanceBy { get; set; }
}
