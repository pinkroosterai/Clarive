using System.ComponentModel.DataAnnotations;

namespace Clarive.Application.Folders;

public record RenameFolderRequest(
    [property: Required(ErrorMessage = "Folder name is required.")]
    [property: StringLength(255, ErrorMessage = "Folder name must be 255 characters or fewer.")]
        string Name
);
