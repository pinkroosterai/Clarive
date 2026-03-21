namespace Clarive.Api.Hubs;

public record PresenceUserDto(string UserId, string Name, string? AvatarUrl, string State);
