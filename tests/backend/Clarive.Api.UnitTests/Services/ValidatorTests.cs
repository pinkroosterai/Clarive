using Clarive.Api.Services;
using FluentAssertions;

namespace Clarive.Api.UnitTests.Services;

public class ValidatorTests
{
    [Theory]
    [InlineData("user@example.com", true)]
    [InlineData("a@b.co", true)]
    [InlineData("user+tag@domain.org", true)]
    [InlineData("", false)]
    [InlineData("noatsign", false)]
    [InlineData("missing@domain", false)]
    [InlineData("@domain.com", false)]
    [InlineData("user@.com", false)]
    public void IsValidEmail_ReturnsExpected(string email, bool expected)
    {
        Validator.IsValidEmail(email).Should().Be(expected);
    }

    [Fact]
    public void RequireString_Null_Returns422()
    {
        var result = Validator.RequireString(null, "Name");
        result.Should().NotBeNull();
    }

    [Fact]
    public void RequireString_Whitespace_Returns422()
    {
        var result = Validator.RequireString("   ", "Name");
        result.Should().NotBeNull();
    }

    [Fact]
    public void RequireString_ExceedsMaxLength_Returns422()
    {
        var result = Validator.RequireString(new string('a', 256), "Name", 255);
        result.Should().NotBeNull();
    }

    [Fact]
    public void RequireString_Valid_ReturnsNull()
    {
        var result = Validator.RequireString("hello", "Name");
        result.Should().BeNull();
    }

    [Fact]
    public void RequireString_ExactMaxLength_ReturnsNull()
    {
        var result = Validator.RequireString(new string('a', 255), "Name", 255);
        result.Should().BeNull();
    }

    [Fact]
    public void RequireValidEmail_Null_Returns422()
    {
        Validator.RequireValidEmail(null).Should().NotBeNull();
    }

    [Fact]
    public void RequireValidEmail_Invalid_Returns422()
    {
        Validator.RequireValidEmail("notanemail").Should().NotBeNull();
    }

    [Fact]
    public void RequireValidEmail_Valid_ReturnsNull()
    {
        Validator.RequireValidEmail("user@example.com").Should().BeNull();
    }

    [Fact]
    public void RequirePassword_Null_Returns422()
    {
        Validator.RequirePassword(null).Should().NotBeNull();
    }

    [Fact]
    public void RequirePassword_TooShort_Returns422()
    {
        Validator.RequirePassword("short").Should().NotBeNull();
    }

    [Fact]
    public void RequirePassword_ExactMinLength_ReturnsNull()
    {
        Validator.RequirePassword(new string('a', Validator.MinPasswordLength)).Should().BeNull();
    }

    [Fact]
    public void RequirePassword_LongEnough_ReturnsNull()
    {
        Validator.RequirePassword("a-very-secure-password-123").Should().BeNull();
    }

    [Fact]
    public void RequirePassword_CustomMinLength_TooShort_Returns422()
    {
        Validator.RequirePassword("abc", 8).Should().NotBeNull();
    }

    [Fact]
    public void RequirePassword_CustomMinLength_Valid_ReturnsNull()
    {
        Validator.RequirePassword("12345678", 8).Should().BeNull();
    }
}
