using Clarive.Core.Services;
using FluentAssertions;

namespace Clarive.Api.UnitTests.Services;

public class UserAgentParserTests
{
    [Fact]
    public void Parse_Null_ReturnsUnknown()
    {
        var (browser, os) = UserAgentParser.Parse(null);
        browser.Should().Be("Unknown");
        os.Should().Be("Unknown");
    }

    [Fact]
    public void Parse_Empty_ReturnsUnknown()
    {
        var (browser, os) = UserAgentParser.Parse("");
        browser.Should().Be("Unknown");
        os.Should().Be("Unknown");
    }

    [Fact]
    public void Parse_Chrome_Windows()
    {
        var ua =
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";
        var (browser, os) = UserAgentParser.Parse(ua);
        browser.Should().Be("Chrome 120");
        os.Should().Be("Windows");
    }

    [Fact]
    public void Parse_Firefox_Linux()
    {
        var ua = "Mozilla/5.0 (X11; Linux x86_64; rv:121.0) Gecko/20100101 Firefox/121.0";
        var (browser, os) = UserAgentParser.Parse(ua);
        browser.Should().Be("Firefox 121");
        os.Should().Be("Linux");
    }

    [Fact]
    public void Parse_Safari_MacOS()
    {
        var ua =
            "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.2 Safari/605.1.15";
        var (browser, os) = UserAgentParser.Parse(ua);
        browser.Should().Be("Safari 17");
        os.Should().Be("macOS");
    }

    [Fact]
    public void Parse_Edge_Windows()
    {
        var ua =
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36 Edg/120.0.0.0";
        var (browser, os) = UserAgentParser.Parse(ua);
        browser.Should().Be("Edge 120");
        os.Should().Be("Windows");
    }

    [Fact]
    public void Parse_Opera_MacOS()
    {
        var ua =
            "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36 OPR/106.0.0.0";
        var (browser, os) = UserAgentParser.Parse(ua);
        browser.Should().Be("Opera 106");
        os.Should().Be("macOS");
    }

    [Fact]
    public void Parse_Vivaldi_Linux()
    {
        var ua =
            "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36 Vivaldi/6.5.3206.50";
        var (browser, os) = UserAgentParser.Parse(ua);
        browser.Should().Be("Vivaldi 6");
        os.Should().Be("Linux");
    }

    [Fact]
    public void Parse_Mobile_iOS()
    {
        var ua =
            "Mozilla/5.0 (iPhone; CPU iPhone OS 17_2 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.2 Mobile/15E148 Safari/604.1";
        var (browser, os) = UserAgentParser.Parse(ua);
        browser.Should().Be("Safari 17");
        os.Should().Be("iOS");
    }

    [Fact]
    public void Parse_Android()
    {
        var ua =
            "Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.6099.144 Mobile Safari/537.36";
        var (browser, os) = UserAgentParser.Parse(ua);
        browser.Should().Be("Chrome 120");
        os.Should().Be("Android");
    }

    [Fact]
    public void Parse_InternetExplorer()
    {
        var ua = "Mozilla/5.0 (Windows NT 10.0; Trident/7.0; rv:11.0) like Gecko";
        var (browser, os) = UserAgentParser.Parse(ua);
        browser.Should().Be("Internet Explorer");
        os.Should().Be("Windows");
    }

    [Fact]
    public void Parse_ChromeOS()
    {
        var ua =
            "Mozilla/5.0 (X11; CrOS x86_64 14541.0.0) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";
        var (browser, os) = UserAgentParser.Parse(ua);
        browser.Should().Be("Chrome 120");
        os.Should().Be("ChromeOS");
    }
}
