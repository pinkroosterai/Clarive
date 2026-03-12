using System.Text.RegularExpressions;

namespace Clarive.Api.Helpers;

public static partial class TagValidation
{
    [GeneratedRegex(@"^[a-z0-9][a-z0-9 \-]*$")]
    public static partial Regex TagNamePattern();
}
