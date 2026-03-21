namespace Clarive.Domain.Constants;

public static class FolderColors
{
    public const string Red = "red";
    public const string Orange = "orange";
    public const string Yellow = "yellow";
    public const string Green = "green";
    public const string Teal = "teal";
    public const string Blue = "blue";
    public const string Purple = "purple";
    public const string Pink = "pink";
    public const string Gray = "gray";

    public static readonly HashSet<string> AllColors =
    [
        Red, Orange, Yellow, Green, Teal, Blue, Purple, Pink, Gray
    ];

    public static bool IsValid(string? color) =>
        color is null || AllColors.Contains(color);
}
