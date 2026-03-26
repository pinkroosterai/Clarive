using Clarive.Domain.Entities;
using Clarive.Domain.Interfaces.Repositories;
using Clarive.Domain.Interfaces.Services;
using Clarive.Infrastructure.Data;
using Microsoft.EntityFrameworkCore;

namespace Clarive.Infrastructure.Repositories;

public class EfSuperAdminRepository(ClariveDbContext db, IUnitOfWork unitOfWork) : ISuperAdminRepository
{
    public async Task<Dictionary<Guid, List<UserWorkspaceInfo>>> GetUserWorkspacesAsync(
        List<Guid> userIds,
        CancellationToken ct = default
    )
    {
        var memberships = await db
            .TenantMemberships.IgnoreQueryFilters()
            .Where(m => userIds.Contains(m.UserId))
            .Join(
                db.Tenants,
                m => m.TenantId,
                t => t.Id,
                (m, t) => new
                {
                    m.UserId,
                    m.TenantId,
                    TenantName = t.Name,
                    m.Role,
                }
            )
            .ToListAsync(ct);

        return memberships
            .GroupBy(m => m.UserId)
            .ToDictionary(
                g => g.Key,
                g => g.Select(m => new UserWorkspaceInfo(m.TenantId, m.TenantName, m.Role)).ToList()
            );
    }

    public async Task HardDeleteUserWithMembershipsAsync(User user, CancellationToken ct = default)
    {
        await unitOfWork.ExecuteInTransactionAsync(
            async () =>
            {
                var userId = user.Id;

                // Delete all user-owned content in FK-safe order (deepest children first).
                // User's entries are the root — many tables reference them transitively.
                var entryIds = $"SELECT id FROM prompt_entries WHERE created_by = {userId}";
                var versionIds = $"SELECT id FROM prompt_entry_versions WHERE entry_id IN ({entryIds})";
                var datasetIds = $"SELECT id FROM test_datasets WHERE entry_id IN ({entryIds})";

                // Deepest leaves first
                await db.Database.ExecuteSqlInterpolatedAsync(
                    $"DELETE FROM ab_test_results WHERE run_id IN (SELECT id FROM ab_test_runs WHERE entry_id IN (SELECT id FROM prompt_entries WHERE created_by = {userId}))",
                    ct
                );
                await db.Database.ExecuteSqlInterpolatedAsync(
                    $"DELETE FROM ab_test_runs WHERE entry_id IN (SELECT id FROM prompt_entries WHERE created_by = {userId})",
                    ct
                );
                await db.Database.ExecuteSqlInterpolatedAsync(
                    $"DELETE FROM ab_test_runs WHERE user_id = {userId}",
                    ct
                );
                await db.Database.ExecuteSqlInterpolatedAsync(
                    $"DELETE FROM test_dataset_rows WHERE dataset_id IN (SELECT id FROM test_datasets WHERE entry_id IN (SELECT id FROM prompt_entries WHERE created_by = {userId}))",
                    ct
                );
                await db.Database.ExecuteSqlInterpolatedAsync(
                    $"DELETE FROM test_datasets WHERE entry_id IN (SELECT id FROM prompt_entries WHERE created_by = {userId})",
                    ct
                );
                await db.Database.ExecuteSqlInterpolatedAsync(
                    $"DELETE FROM prompts WHERE version_id IN (SELECT id FROM prompt_entry_versions WHERE entry_id IN (SELECT id FROM prompt_entries WHERE created_by = {userId}))",
                    ct
                );
                await db.Database.ExecuteSqlInterpolatedAsync(
                    $"DELETE FROM playground_runs WHERE entry_id IN (SELECT id FROM prompt_entries WHERE created_by = {userId})",
                    ct
                );
                await db.Database.ExecuteSqlInterpolatedAsync(
                    $"DELETE FROM share_links WHERE entry_id IN (SELECT id FROM prompt_entries WHERE created_by = {userId})",
                    ct
                );
                await db.Database.ExecuteSqlInterpolatedAsync(
                    $"DELETE FROM entry_tags WHERE entry_id IN (SELECT id FROM prompt_entries WHERE created_by = {userId})",
                    ct
                );
                await db.Database.ExecuteSqlInterpolatedAsync(
                    $"DELETE FROM entry_favorites WHERE entry_id IN (SELECT id FROM prompt_entries WHERE created_by = {userId})",
                    ct
                );
                await db.Database.ExecuteSqlInterpolatedAsync(
                    $"DELETE FROM ai_usage_logs WHERE entry_id IN (SELECT id FROM prompt_entries WHERE created_by = {userId})",
                    ct
                );
                await db.Database.ExecuteSqlInterpolatedAsync(
                    $"DELETE FROM prompt_entry_versions WHERE entry_id IN (SELECT id FROM prompt_entries WHERE created_by = {userId})",
                    ct
                );
                await db.Database.ExecuteSqlInterpolatedAsync(
                    $"UPDATE prompt_entry_versions SET published_by = NULL WHERE published_by = {userId}",
                    ct
                );
                await db.Database.ExecuteSqlInterpolatedAsync(
                    $"DELETE FROM prompt_entries WHERE created_by = {userId}",
                    ct
                );

                // User-level references
                await db.Database.ExecuteSqlInterpolatedAsync(
                    $"DELETE FROM entry_favorites WHERE user_id = {userId}",
                    ct
                );
                await db.Database.ExecuteSqlInterpolatedAsync(
                    $"DELETE FROM login_sessions WHERE user_id = {userId}",
                    ct
                );
                await db.Database.ExecuteSqlInterpolatedAsync(
                    $"DELETE FROM refresh_tokens WHERE user_id = {userId}",
                    ct
                );
                await db.Database.ExecuteSqlInterpolatedAsync(
                    $"DELETE FROM email_verification_tokens WHERE user_id = {userId}",
                    ct
                );
                await db.Database.ExecuteSqlInterpolatedAsync(
                    $"DELETE FROM password_reset_tokens WHERE user_id = {userId}",
                    ct
                );

                // Nullify invitation references (preserve invitations)
                await db.Database.ExecuteSqlInterpolatedAsync(
                    $"UPDATE invitations SET target_user_id = NULL WHERE target_user_id = {userId}",
                    ct
                );
                await db.Database.ExecuteSqlInterpolatedAsync(
                    $"UPDATE invitations SET invited_by_id = NULL WHERE invited_by_id = {userId}",
                    ct
                );

                // Nullify tenant ownership (preserve tenants for other members)
                await db.Database.ExecuteSqlInterpolatedAsync(
                    $"UPDATE tenants SET owner_id = NULL WHERE owner_id = {userId}",
                    ct
                );

                // Delete memberships and user
                await db.Database.ExecuteSqlInterpolatedAsync(
                    $"DELETE FROM tenant_memberships WHERE user_id = {userId}",
                    ct
                );
                await db.Database.ExecuteSqlInterpolatedAsync(
                    $"DELETE FROM users WHERE id = {userId}",
                    ct
                );
            },
            ct
        );
    }
}
