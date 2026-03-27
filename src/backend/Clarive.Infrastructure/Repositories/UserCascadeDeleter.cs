using Clarive.Infrastructure.Data;
using Microsoft.EntityFrameworkCore;

namespace Clarive.Infrastructure.Repositories;

/// <summary>
/// Deletes all user-owned content in FK-safe order before removing the user row.
/// Shared by hard-delete (super admin) and scheduled purge (background job).
/// </summary>
public static class UserCascadeDeleter
{
    public static async Task DeleteUserCascadeAsync(ClariveDbContext db, Guid userId, CancellationToken ct)
    {
        // Deepest children first — entry sub-trees
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
            $"DELETE FROM entry_favorites WHERE user_id = {userId}", ct
        );
        await db.Database.ExecuteSqlInterpolatedAsync(
            $"DELETE FROM login_sessions WHERE user_id = {userId}", ct
        );
        await db.Database.ExecuteSqlInterpolatedAsync(
            $"DELETE FROM refresh_tokens WHERE user_id = {userId}", ct
        );
        await db.Database.ExecuteSqlInterpolatedAsync(
            $"DELETE FROM email_verification_tokens WHERE user_id = {userId}", ct
        );
        await db.Database.ExecuteSqlInterpolatedAsync(
            $"DELETE FROM password_reset_tokens WHERE user_id = {userId}", ct
        );

        // Nullify references (preserve related entities for other users)
        await db.Database.ExecuteSqlInterpolatedAsync(
            $"UPDATE invitations SET target_user_id = NULL WHERE target_user_id = {userId}", ct
        );
        await db.Database.ExecuteSqlInterpolatedAsync(
            $"UPDATE invitations SET invited_by_id = NULL WHERE invited_by_id = {userId}", ct
        );
        await db.Database.ExecuteSqlInterpolatedAsync(
            $"UPDATE tenants SET owner_id = NULL WHERE owner_id = {userId}", ct
        );

        // Delete memberships and user
        await db.Database.ExecuteSqlInterpolatedAsync(
            $"DELETE FROM tenant_memberships WHERE user_id = {userId}", ct
        );
        await db.Database.ExecuteSqlInterpolatedAsync(
            $"DELETE FROM users WHERE id = {userId}", ct
        );
    }
}
