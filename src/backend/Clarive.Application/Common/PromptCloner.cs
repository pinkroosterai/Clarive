using Clarive.Domain.Entities;

namespace Clarive.Application.Common;

public static class PromptCloner
{
    /// <summary>
    /// Deep-clones a list of prompts with new GUIDs, suitable for creating new versions or variants.
    /// </summary>
    public static List<Prompt> ClonePrompts(List<Prompt> source, Guid newVersionId)
    {
        return source.Select(p =>
        {
            var newPromptId = Guid.NewGuid();
            return new Prompt
            {
                Id = newPromptId,
                VersionId = newVersionId,
                Content = p.Content,
                Order = p.Order,
                IsTemplate = p.IsTemplate,
                TemplateFields = p.TemplateFields.Select(tf => new TemplateField
                {
                    Id = Guid.NewGuid(),
                    PromptId = newPromptId,
                    Name = tf.Name,
                    Type = tf.Type,
                    EnumValues = tf.EnumValues,
                    DefaultValue = tf.DefaultValue,
                    Min = tf.Min,
                    Max = tf.Max,
                }).ToList(),
            };
        }).ToList();
    }
}
