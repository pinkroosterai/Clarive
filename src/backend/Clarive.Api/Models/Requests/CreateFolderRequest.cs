using System.ComponentModel.DataAnnotations;

namespace Clarive.Api.Models.Requests;

public record CreateFolderRequest(
    [property: Required(ErrorMessage = "Folder name is required.")]
    [property: StringLength(255, ErrorMessage = "Folder name must be 255 characters or fewer.")]
        string Name,
    Guid? ParentId
);
