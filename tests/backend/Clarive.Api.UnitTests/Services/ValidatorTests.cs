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
}
