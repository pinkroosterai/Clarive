namespace Clarive.Api.Hubs;

public interface IPresenceClient
{
    Task UserJoined(PresenceUserDto user);
    Task UserLeft(string userId);
    Task UserStateChanged(string userId, string state);
    Task CurrentUsers(List<PresenceUserDto> users);
}
