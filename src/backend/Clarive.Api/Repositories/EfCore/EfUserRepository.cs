using Clarive.Api.Data;
using Clarive.Api.Models.Entities;
using Clarive.Api.Repositories.Interfaces;
using Microsoft.EntityFrameworkCore;

namespace Clarive.Api.Repositories.EfCore;

public class EfUserRepository(ClariveDbContext db) : IUserRepository
{
    public async Task<User?> GetByEmailAsync(string email, CancellationToken ct = default)
    {
        var normalized = email.Trim().ToLowerInvariant();
        return await db.Users.IgnoreQueryFilters().FirstOrDefaultAsync(u => u.Email == normalized, ct);
    }

    public async Task<User?> GetByGoogleIdAsync(string googleId, CancellationToken ct = default)
    {
        return await db.Users.IgnoreQueryFilters().FirstOrDefaultAsync(u => u.GoogleId == googleId, ct);
    }

    public async Task<User?> GetByIdAsync(Guid tenantId, Guid userId, CancellationToken ct = default)
    {
        return await db.Users.FirstOrDefaultAsync(u => u.Id == userId && u.TenantId == tenantId, ct);
    }

    public async Task<User?> GetByIdCrossTenantsAsync(Guid userId, CancellationToken ct = default)
    {
        return await db.Users.IgnoreQueryFilters().FirstOrDefaultAsync(u => u.Id == userId, ct);
    }

    public async Task<Dictionary<Guid, User>> GetByIdsAsync(Guid tenantId, IEnumerable<Guid> userIds, CancellationToken ct = default)
    {
        var ids = userIds.ToList();
        if (ids.Count == 0) return [];

        var users = await db.Users.AsNoTracking()
            .Where(u => u.TenantId == tenantId && ids.Contains(u.Id))
            .ToListAsync(ct);

        return users.ToDictionary(u => u.Id);
    }

    public async Task<List<User>> GetByTenantAsync(Guid tenantId, CancellationToken ct = default)
    {
        return await db.Users.AsNoTracking().Where(u => u.TenantId == tenantId).ToListAsync(ct);
    }

    public async Task<(List<User> Users, int Total)> GetByTenantPagedAsync(
        Guid tenantId, int page, int pageSize, CancellationToken ct = default)
    {
        var query = db.Users.AsNoTracking().Where(u => u.TenantId == tenantId);
        var total = await query.CountAsync(ct);
        var users = await query
            .OrderBy(u => u.Name)
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .ToListAsync(ct);
        return (users, total);
    }

    public async Task<User> CreateAsync(User user, CancellationToken ct = default)
    {
        db.Users.Add(user);
        await db.SaveChangesAsync(ct);
        return user;
    }

    public async Task<User> UpdateAsync(User user, CancellationToken ct = default)
    {
        await db.SaveChangesAsync(ct);
        return user;
    }

    public async Task<bool> DeleteAsync(Guid tenantId, Guid userId, CancellationToken ct = default)
    {
        var user = await db.Users.FirstOrDefaultAsync(u => u.Id == userId && u.TenantId == tenantId, ct);
        if (user is null) return false;
        db.Users.Remove(user);
        await db.SaveChangesAsync(ct);
        return true;
    }

    public async Task<bool> AnyUsersExistAsync(CancellationToken ct = default)
        => await db.Users.IgnoreQueryFilters().AnyAsync(ct);

    public async Task<(List<User> Users, int Total)> GetAllUsersPagedAsync(
        int page, int pageSize, string? search, string? sortBy, bool sortDesc, CancellationToken ct = default)
    {
        var query = db.Users.IgnoreQueryFilters().AsNoTracking()
            .Where(u => u.DeletedAt == null);

        if (!string.IsNullOrWhiteSpace(search))
        {
            var pattern = $"%{search}%";
            query = query.Where(u =>
                EF.Functions.ILike(u.Name, pattern) ||
                EF.Functions.ILike(u.Email, pattern));
        }

        query = sortBy?.ToLowerInvariant() switch
        {
            "name" => sortDesc ? query.OrderByDescending(u => u.Name) : query.OrderBy(u => u.Name),
            "email" => sortDesc ? query.OrderByDescending(u => u.Email) : query.OrderBy(u => u.Email),
            "role" => sortDesc ? query.OrderByDescending(u => u.Role) : query.OrderBy(u => u.Role),
            _ => sortDesc ? query.OrderByDescending(u => u.CreatedAt) : query.OrderBy(u => u.CreatedAt),
        };

        var total = await query.CountAsync(ct);
        var users = await query
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .ToListAsync(ct);

        return (users, total);
    }
}
