using System.Text.RegularExpressions;

namespace Clarive.Core.Services;

public static partial class UserAgentParser
{
    public static (string Browser, string Os) Parse(string? userAgent)
    {
        if (string.IsNullOrWhiteSpace(userAgent))
            return ("Unknown", "Unknown");

        return (ParseBrowser(userAgent), ParseOs(userAgent));
    }

    private static string ParseBrowser(string ua)
    {
        // Order matters: check specific browsers before generic ones.
        // Edge must come before Chrome (Edge UA contains "Chrome").
        if (EdgeRegex().IsMatch(ua))
            return ExtractVersion(EdgeRegex(), ua, "Edge");
        if (OperaGxRegex().IsMatch(ua))
            return ExtractVersion(OperaGxRegex(), ua, "Opera GX");
        if (OperaRegex().IsMatch(ua))
            return ExtractVersion(OperaRegex(), ua, "Opera");
        if (VivaldiRegex().IsMatch(ua))
            return ExtractVersion(VivaldiRegex(), ua, "Vivaldi");
        if (BraveRegex().IsMatch(ua))
            return "Brave";
        if (ChromeRegex().IsMatch(ua))
            return ExtractVersion(ChromeRegex(), ua, "Chrome");
        if (FirefoxRegex().IsMatch(ua))
            return ExtractVersion(FirefoxRegex(), ua, "Firefox");
        if (SafariRegex().IsMatch(ua) && !ua.Contains("Chrome"))
            return ExtractVersion(SafariVersionRegex(), ua, "Safari");
        if (ua.Contains("MSIE") || ua.Contains("Trident"))
            return "Internet Explorer";

        return "Unknown";
    }

    private static string ParseOs(string ua)
    {
        if (ua.Contains("iPhone") || ua.Contains("iPad") || ua.Contains("iPod"))
            return "iOS";
        if (ua.Contains("Android"))
            return "Android";
        if (ua.Contains("Windows"))
            return "Windows";
        if (ua.Contains("Mac OS X") || ua.Contains("Macintosh"))
            return "macOS";
        if (ua.Contains("CrOS"))
            return "ChromeOS";
        if (ua.Contains("Linux"))
            return "Linux";

        return "Unknown";
    }

    private static string ExtractVersion(Regex regex, string ua, string name)
    {
        var match = regex.Match(ua);
        if (match.Success && match.Groups.Count > 1)
        {
            var version = match.Groups[1].Value;
            var major = version.Split('.')[0];
            return $"{name} {major}";
        }
        return name;
    }

    [GeneratedRegex(@"Edg(?:e|A|iOS)?/(\d[\d.]+)")]
    private static partial Regex EdgeRegex();

    [GeneratedRegex(@"OPR/(\d[\d.]+)")]
    private static partial Regex OperaRegex();

    [GeneratedRegex(@"OPRGX/(\d[\d.]+)")]
    private static partial Regex OperaGxRegex();

    [GeneratedRegex(@"Vivaldi/(\d[\d.]+)")]
    private static partial Regex VivaldiRegex();

    [GeneratedRegex(@"Chrome/(\d[\d.]+)")]
    private static partial Regex ChromeRegex();

    [GeneratedRegex(@"Firefox/(\d[\d.]+)")]
    private static partial Regex FirefoxRegex();

    [GeneratedRegex(@"Safari/(\d[\d.]+)")]
    private static partial Regex SafariRegex();

    [GeneratedRegex(@"Version/(\d[\d.]+).*Safari")]
    private static partial Regex SafariVersionRegex();

    [GeneratedRegex(@"Brave")]
    private static partial Regex BraveRegex();
}
