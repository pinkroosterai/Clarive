using System.Text.RegularExpressions;

namespace Clarive.Application.Tags;

public static partial class TagValidation
{
    [GeneratedRegex(@"^[a-z0-9][a-z0-9 \-]*$")]
    public static partial Regex TagNamePattern();
}
