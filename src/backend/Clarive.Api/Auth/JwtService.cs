using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using System.Security.Cryptography;
using System.Text;
using Clarive.Domain.Entities;
using Clarive.Domain.Enums;
using Microsoft.Extensions.Options;
using Microsoft.IdentityModel.Tokens;

namespace Clarive.Api.Auth;

public class JwtService
{
    private readonly IOptionsMonitor<JwtSettings> _optionsMonitor;

    public JwtService(IOptionsMonitor<JwtSettings> optionsMonitor)
    {
        _optionsMonitor = optionsMonitor;
    }

    public string GenerateToken(User user)
    {
        return GenerateToken(user, user.TenantId, user.Role);
    }

    public string GenerateToken(User user, Guid tenantId, UserRole role)
    {
        var settings = _optionsMonitor.CurrentValue;

        var claims = new List<Claim>
        {
            new(ClaimTypes.NameIdentifier, user.Id.ToString()),
            new("tenantId", tenantId.ToString()),
            new(ClaimTypes.Name, user.Name),
            new(ClaimTypes.Role, role.ToString().ToLower()),
            new("emailVerified", user.EmailVerified.ToString().ToLower()),
        };

        if (user.IsSuperUser)
            claims.Add(new Claim("superUser", "true"));

        var key = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(settings.Secret));
        var creds = new SigningCredentials(key, SecurityAlgorithms.HmacSha256);

        var token = new JwtSecurityToken(
            issuer: settings.Issuer,
            audience: settings.Audience,
            claims: claims,
            expires: DateTime.UtcNow.AddMinutes(settings.ExpirationMinutes),
            signingCredentials: creds
        );

        return new JwtSecurityTokenHandler().WriteToken(token);
    }

    /// <summary>
    /// Generates a cryptographically random refresh token.
    /// Returns the raw token (to send to the client) and its SHA256 hash (to store in DB).
    /// </summary>
    public (string RawToken, string TokenHash) GenerateRefreshToken()
    {
        var bytes = RandomNumberGenerator.GetBytes(32);
        var rawToken =
            "rt_" + Convert.ToBase64String(bytes).Replace("+", "-").Replace("/", "_").TrimEnd('=');
        var hash = SHA256.HashData(Encoding.UTF8.GetBytes(rawToken));
        var tokenHash = Convert.ToHexStringLower(hash);
        return (rawToken, tokenHash);
    }

    /// <summary>
    /// Generates a cryptographically random invitation token.
    /// Returns the raw token (to send via email) and its SHA256 hash (to store in DB).
    /// </summary>
    public (string RawToken, string TokenHash) GenerateInvitationToken()
    {
        var bytes = RandomNumberGenerator.GetBytes(32);
        var rawToken =
            "inv_" + Convert.ToBase64String(bytes).Replace("+", "-").Replace("/", "_").TrimEnd('=');
        var hash = SHA256.HashData(Encoding.UTF8.GetBytes(rawToken));
        var tokenHash = Convert.ToHexStringLower(hash);
        return (rawToken, tokenHash);
    }

    /// <summary>
    /// Hashes a raw refresh token for DB lookup.
    /// </summary>
    public static string HashRefreshToken(string rawToken)
    {
        var hash = SHA256.HashData(Encoding.UTF8.GetBytes(rawToken));
        return Convert.ToHexStringLower(hash);
    }

    public int RefreshTokenExpirationDays =>
        _optionsMonitor.CurrentValue.RefreshTokenExpirationDays;
}
