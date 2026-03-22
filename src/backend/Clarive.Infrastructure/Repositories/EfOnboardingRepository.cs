using Clarive.Domain.Entities;
using Clarive.Domain.Interfaces.Repositories;
using Clarive.Infrastructure.Data;

namespace Clarive.Infrastructure.Repositories;

public class EfOnboardingRepository(ClariveDbContext db) : IOnboardingRepository
{
    public async Task SeedAsync(
        Folder folder,
        List<PromptEntry> entries,
        List<PromptEntryVersion> versions,
        CancellationToken ct = default
    )
    {
        db.Folders.Add(folder);
        db.PromptEntries.AddRange(entries);
        db.PromptEntryVersions.AddRange(versions);
        await db.SaveChangesAsync(ct);
    }
}
