using Clarive.Domain.Entities;

namespace Clarive.Domain.Interfaces.Repositories;

public interface IOnboardingRepository
{
    Task SeedAsync(
        Folder folder,
        List<PromptEntry> entries,
        List<PromptEntryVersion> versions,
        CancellationToken ct = default
    );
}
