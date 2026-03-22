using Clarive.Domain.Entities;
using Clarive.Domain.Enums;
using Clarive.Domain.Interfaces.Repositories;

namespace Clarive.Application.Common;

public class OnboardingSeeder(IOnboardingRepository repo) : IOnboardingSeeder
{
    public async Task SeedStarterTemplatesAsync(Guid tenantId, Guid userId, CancellationToken ct)
    {
        var now = DateTime.UtcNow;
        var entries = new List<PromptEntry>();
        var versions = new List<PromptEntryVersion>();

        // 1. Create "Getting Started" folder at root level
        var folder = new Folder
        {
            Id = Guid.NewGuid(),
            TenantId = tenantId,
            Name = "Getting Started",
            ParentId = null,
            CreatedAt = now,
        };

        // 2. Blog Post Writer
        CreatePublishedEntry(
            entries, versions, tenantId, userId, folder.Id, now,
            title: "Blog Post Writer",
            systemMessage: "You are a professional blog writer. Write engaging, well-structured blog posts on the given topic. Use clear headings, practical examples, and a compelling introduction.",
            prompts:
            [
                "Write a {{word_count}} word blog post about {{topic}} in a {{tone}} tone. Include an engaging introduction, 3-5 key sections with subheadings, and a conclusion with a call to action.",
            ]
        );

        // 3. Code Review Assistant
        CreatePublishedEntry(
            entries, versions, tenantId, userId, folder.Id, now,
            title: "Code Review Assistant",
            systemMessage: "You are an experienced senior developer performing code reviews. Analyze code for bugs, performance issues, security concerns, and adherence to best practices. Be specific and constructive.",
            prompts:
            [
                "Review the following {{language}} code and provide detailed feedback on bugs, performance, security, and code style:\n\n```\n{{code_snippet}}\n```",
            ]
        );

        // 4. Email Composer (prompt chain — 2 prompts)
        CreatePublishedEntry(
            entries, versions, tenantId, userId, folder.Id, now,
            title: "Email Composer",
            systemMessage: "You are a professional email writer. Draft clear, concise, and well-structured emails for business communication.",
            prompts:
            [
                "Draft a {{tone}} email to {{recipient}} about {{purpose}}. Keep it professional, concise, and include a clear subject line suggestion.",
                "Review and refine the draft email above. Improve clarity, fix any grammatical issues, ensure the tone matches \"{{tone}}\", and suggest an alternative subject line.",
            ]
        );

        await repo.SeedAsync(folder, entries, versions, ct);
    }

    private static void CreatePublishedEntry(
        List<PromptEntry> entries,
        List<PromptEntryVersion> versions,
        Guid tenantId,
        Guid userId,
        Guid folderId,
        DateTime now,
        string title,
        string systemMessage,
        List<string> prompts
    )
    {
        var entryId = Guid.NewGuid();
        var versionId = Guid.NewGuid();

        var entry = new PromptEntry
        {
            Id = entryId,
            TenantId = tenantId,
            Title = title,
            FolderId = folderId,
            CreatedBy = userId,
            CreatedAt = now,
            UpdatedAt = now,
        };

        var promptEntities = prompts
            .Select(
                (content, i) =>
                {
                    var fields = TemplateParser.Parse(content);
                    var promptId = Guid.NewGuid();
                    foreach (var f in fields)
                        f.PromptId = promptId;

                    return new Prompt
                    {
                        Id = promptId,
                        VersionId = versionId,
                        Content = content,
                        Order = i,
                        IsTemplate = fields.Count > 0,
                        TemplateFields = fields,
                    };
                }
            )
            .ToList();

        var version = new PromptEntryVersion
        {
            Id = versionId,
            EntryId = entryId,
            Version = 1,
            VersionState = VersionState.Published,
            SystemMessage = systemMessage,
            Prompts = promptEntities,
            PublishedAt = now,
            PublishedBy = userId,
            CreatedAt = now,
        };

        entries.Add(entry);
        versions.Add(version);
    }
}
