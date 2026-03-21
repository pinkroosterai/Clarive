using System.ComponentModel.DataAnnotations;

namespace Clarive.Application.Folders.Contracts;

public record SetFolderColorRequest(
    [property: StringLength(20, ErrorMessage = "Color value must be 20 characters or fewer.")]
        string? Color
);
