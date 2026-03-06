import {
  CircleHelp,
  Rocket,
  FileText,
  Wand2,
  Braces,
  FolderTree,
  Users,
  Wrench,
  Key,
  Keyboard,
  Settings,
  Globe,
} from 'lucide-react';
import { useEffect } from 'react';

import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';

function Kbd({ children }: { children: React.ReactNode }) {
  return (
    <kbd className="bg-elevated rounded px-1.5 py-0.5 text-xs font-mono border border-border-subtle">
      {children}
    </kbd>
  );
}

function Code({ children }: { children: React.ReactNode }) {
  return (
    <code className="bg-elevated rounded px-1.5 py-0.5 text-xs font-mono border border-border-subtle">
      {children}
    </code>
  );
}

function SectionIcon({ icon: Icon }: { icon: React.ElementType }) {
  return <Icon className="size-4 shrink-0 text-foreground-muted mr-2" />;
}

const sections = [
  {
    id: 'getting-started',
    icon: Rocket,
    title: 'Getting Started',
    content: (
      <div className="space-y-3">
        <p>
          Clarive is a prompt management platform that helps you create, version, organize, and
          share LLM prompts with your team.
        </p>
        <h4 className="text-sm font-semibold text-foreground">Your Dashboard</h4>
        <p>
          The dashboard is your home base. It shows key stats like your total entries and published
          prompts, a list of recently edited entries, and an activity feed of changes across your
          workspace.
        </p>
        <h4 className="text-sm font-semibold text-foreground">Creating Your First Entry</h4>
        <ul className="list-disc list-inside space-y-1">
          <li>
            Click <strong>New Entry</strong> in the sidebar to start from scratch.
          </li>
          <li>
            Or use the <strong>AI Wizard</strong> to generate a prompt from a description — click{' '}
            <strong>New Entry</strong> and then <strong>Use AI Wizard</strong>.
          </li>
          <li>
            Give your entry a title, optionally set a system message, and write your prompt in the
            editor.
          </li>
          <li>
            Save as a draft or publish when ready. Published entries are versioned automatically.
          </li>
        </ul>
      </div>
    ),
  },
  {
    id: 'entry-editor',
    icon: FileText,
    title: 'Entry Editor',
    content: (
      <div className="space-y-3">
        <h4 className="text-sm font-semibold text-foreground">Editor Layout</h4>
        <p>
          Each entry has a <strong>title</strong>, an optional <strong>system message</strong>{' '}
          (instructions for the AI), and one or more <strong>prompt cards</strong> written in the
          rich-text editor. The action panel on the right provides save, publish, and AI tools.
        </p>
        <h4 className="text-sm font-semibold text-foreground">Prompt Chains</h4>
        <p>
          Entries can contain multiple prompts arranged as a chain. Click{' '}
          <strong>Add follow-up prompt</strong> to append a new prompt card. Reorder prompts with
          the up/down arrows, or remove them with the delete button on each card.
        </p>
        <h4 className="text-sm font-semibold text-foreground">Rich-Text Editing</h4>
        <p>
          The editor supports markdown-style formatting: bold, italic, headings (H1–H3), bullet and
          numbered lists, inline code, and code blocks. Select text to reveal the{' '}
          <strong>bubble menu</strong> with formatting options, or use keyboard shortcuts.
        </p>
        <h4 className="text-sm font-semibold text-foreground">Entry States</h4>
        <ul className="list-disc list-inside space-y-1">
          <li>
            <strong>Draft</strong> — work in progress, only visible to you and your team.
          </li>
          <li>
            <strong>Published</strong> — the current active version of the prompt. Editing a
            published entry creates a new draft without affecting the published version.
          </li>
          <li>
            <strong>Historical</strong> — a previous version, kept for reference. You can restore
            any historical version as a new draft.
          </li>
        </ul>
        <h4 className="text-sm font-semibold text-foreground">Versioning</h4>
        <p>
          Every time you publish an entry, a new version is created automatically. Use the version
          history panel to browse past versions, compare any two versions side-by-side with a diff
          view, or restore a historical version as a new draft.
        </p>
        <h4 className="text-sm font-semibold text-foreground">AI Tools</h4>
        <ul className="list-disc list-inside space-y-1">
          <li>
            <strong>Enhance with AI</strong> — analyze and improve your current prompt.
          </li>
          <li>
            <strong>Generate System Message</strong> — automatically generate a system message based
            on your prompt content (available when no system message is set).
          </li>
          <li>
            <strong>Decompose to Chain</strong> — split a single prompt into a multi-step prompt
            chain (available for single-prompt entries).
          </li>
        </ul>
      </div>
    ),
  },
  {
    id: 'ai-wizard',
    icon: Wand2,
    title: 'AI Wizard',
    content: (
      <div className="space-y-3">
        <p>
          The AI Wizard helps you generate high-quality prompts from a simple description. It
          follows a guided flow:
        </p>
        <ol className="list-decimal list-inside space-y-2">
          <li>
            <strong>Describe</strong> — Tell the wizard what kind of prompt you need. Be as specific
            as possible about the task, audience, and desired output. You can also configure
            options: generate a system message, create a prompt template with variables, generate a
            multi-step prompt chain, or select tools for the AI to use.
          </li>
          <li>
            <strong>Clarify</strong> — The wizard may ask follow-up questions to refine its
            understanding. Answer them for a better result, or skip to proceed directly.
          </li>
          <li>
            <strong>Review</strong> — Review the generated prompt with a quality score across six
            dimensions: clarity, specificity, structure, completeness, autonomy, and faithfulness
            (each scored 0–10). You can iteratively refine the prompt until you are satisfied.
          </li>
          <li>
            <strong>Save</strong> — Save the generated prompt as a new entry in your library.
          </li>
        </ol>
        <h4 className="text-sm font-semibold text-foreground">Enhancing Existing Entries</h4>
        <p>
          You can also enhance an existing entry by opening it in the editor and clicking{' '}
          <strong>Enhance with AI</strong>. The wizard will analyze your current prompt, show
          quality scores, and let you refine before saving the improvements back to the entry.
        </p>
      </div>
    ),
  },
  {
    id: 'templates',
    icon: Braces,
    title: 'Templates & Variables',
    content: (
      <div className="space-y-3">
        <h4 className="text-sm font-semibold text-foreground">Template Syntax</h4>
        <p>
          Use double curly braces to define variables in your prompts. Variables are placeholders
          that get replaced with actual values when the prompt is used. Clarive automatically
          detects and highlights them in the editor.
        </p>
        <h4 className="text-sm font-semibold text-foreground">Variable Types</h4>
        <div className="bg-elevated rounded-md border border-border-subtle overflow-hidden">
          <table className="w-full text-xs font-mono">
            <thead>
              <tr className="border-b border-border-subtle">
                <th className="text-left p-2 font-semibold text-foreground">Type</th>
                <th className="text-left p-2 font-semibold text-foreground">Syntax</th>
                <th className="text-left p-2 font-semibold text-foreground">Input</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border-subtle">
              <tr>
                <td className="p-2">string</td>
                <td className="p-2">{'{{topic}}'}</td>
                <td className="p-2 font-sans">Text input (default)</td>
              </tr>
              <tr>
                <td className="p-2">int</td>
                <td className="p-2">{'{{count|int:1-100}}'}</td>
                <td className="p-2 font-sans">Integer with range</td>
              </tr>
              <tr>
                <td className="p-2">float</td>
                <td className="p-2">{'{{temp|float:0-1.5}}'}</td>
                <td className="p-2 font-sans">Decimal with range</td>
              </tr>
              <tr>
                <td className="p-2">enum</td>
                <td className="p-2">{'{{tone|enum:formal,casual}}'}</td>
                <td className="p-2 font-sans">Dropdown select</td>
              </tr>
            </tbody>
          </table>
        </div>
        <p className="text-xs text-foreground-muted">
          Variable names can contain letters, digits, and underscores. The first occurrence of a
          variable name determines its type.
        </p>
        <h4 className="text-sm font-semibold text-foreground">Example</h4>
        <p className="bg-elevated rounded-md p-3 text-xs font-mono border border-border-subtle">
          Write a {'{{tone|enum:formal,casual}}'} email to {'{{recipient}}'} about {'{{topic}}'},
          limited to {'{{wordCount|int:50-500}}'} words.
        </p>
        <h4 className="text-sm font-semibold text-foreground">Template Form</h4>
        <p>
          When your prompt contains template variables, a collapsible <strong>Template</strong>{' '}
          section appears below the editor. Fill in values and click <strong>Preview</strong> to see
          the rendered output with your variables replaced.
        </p>
      </div>
    ),
  },
  {
    id: 'folders',
    icon: FolderTree,
    title: 'Folders & Organization',
    content: (
      <div className="space-y-3">
        <p>Organize your entries into folders using the folder tree in the sidebar.</p>
        <h4 className="text-sm font-semibold text-foreground">Managing Folders</h4>
        <ul className="list-disc list-inside space-y-1">
          <li>
            Click <strong>New folder</strong> at the bottom of the folder tree to create a
            root-level folder.
          </li>
          <li>
            Hover over a folder and click the <strong>three-dot menu</strong> to create a subfolder,
            rename, or delete.
          </li>
          <li>Folders can be nested to create a hierarchy that suits your workflow.</li>
          <li>Click a folder in the sidebar to view all entries within it.</li>
        </ul>
        <h4 className="text-sm font-semibold text-foreground">Drag and Drop</h4>
        <p>
          Move entries between folders by dragging them in the library view. You can also drag
          folders to reorganize your folder structure. Drop an entry or folder onto another folder
          to move it inside. Folders automatically expand when you hover over them during a drag.
        </p>
      </div>
    ),
  },
  {
    id: 'workspaces',
    icon: Users,
    title: 'Workspaces & Teams',
    content: (
      <div className="space-y-3">
        <h4 className="text-sm font-semibold text-foreground">Personal vs Shared Workspaces</h4>
        <p>
          Every account starts with a <strong>personal workspace</strong> that only you can access.
          You may also be invited to <strong>shared workspaces</strong> to collaborate with team
          members. Each workspace has its own entries, folders, and settings.
        </p>
        <h4 className="text-sm font-semibold text-foreground">Switching Workspaces</h4>
        <p>
          Use the <strong>workspace switcher</strong> at the top of the sidebar to switch between
          your workspaces. Your active workspace is indicated with a checkmark.
        </p>
        <h4 className="text-sm font-semibold text-foreground">Inviting Members</h4>
        <p>
          Workspace admins can invite new members from <strong>Settings &gt; Users</strong>.
          Invitations are sent by email and must be accepted before the user can access the
          workspace. Admins can also resend or revoke pending invitations.
        </p>
        <h4 className="text-sm font-semibold text-foreground">Accepting Invitations</h4>
        <p>
          When you receive an invitation, a notification badge appears on the bell icon in the
          sidebar. Click it to view, accept, or decline pending invitations.
        </p>
        <h4 className="text-sm font-semibold text-foreground">Roles</h4>
        <ul className="list-disc list-inside space-y-1">
          <li>
            <strong>Admin</strong> — full control over the workspace: manage members, settings, and
            all entries.
          </li>
          <li>
            <strong>Editor</strong> — create, edit, and publish entries. Cannot manage members.
          </li>
          <li>
            <strong>Viewer</strong> — read-only access to entries. Cannot create or modify content.
          </li>
        </ul>
        <h4 className="text-sm font-semibold text-foreground">Leaving a Workspace</h4>
        <p>
          You can leave any shared workspace from <strong>Settings &gt; Users</strong>. Personal
          workspaces cannot be left.
        </p>
      </div>
    ),
  },
  {
    id: 'tools',
    icon: Wrench,
    title: 'Tools & MCP',
    content: (
      <div className="space-y-3">
        <h4 className="text-sm font-semibold text-foreground">What Are Tool Descriptions?</h4>
        <p>
          Tool descriptions define external tools or functions that an AI model can use when
          executing your prompts. They include a name, a tool identifier, and a description of what
          the tool does.
        </p>
        <h4 className="text-sm font-semibold text-foreground">Managing Tools</h4>
        <ul className="list-disc list-inside space-y-1">
          <li>
            Go to <strong>Settings → Tools</strong>.
          </li>
          <li>
            Click <strong>Add Tool</strong> to manually define a new tool description with a display
            name, tool identifier, and description.
          </li>
          <li>Edit any existing tool by clicking the pencil icon on its card.</li>
          <li>Delete a tool by clicking the trash icon (with confirmation).</li>
        </ul>
        <h4 className="text-sm font-semibold text-foreground">MCP Import</h4>
        <p>
          You can also import tool descriptions from an{' '}
          <strong>MCP (Model Context Protocol) server</strong>. Enter the server URL in the MCP
          Import section on the Tools page to automatically discover and import available tools. If
          the server requires authentication, you can provide an optional bearer token. Tools that
          already exist in your workspace are automatically skipped.
        </p>
      </div>
    ),
  },
  {
    id: 'api-keys',
    icon: Key,
    title: 'API Keys',
    content: (
      <div className="space-y-3">
        <p>
          API keys allow you to access Clarive programmatically via the REST API. Only workspace
          admins can create and manage API keys.
        </p>
        <h4 className="text-sm font-semibold text-foreground">Creating a Key</h4>
        <p>
          Go to <strong>Settings &gt; API Keys</strong> and click <strong>Create API Key</strong>.
          Give it a descriptive name so you can identify its purpose later. The full key is
          displayed only once after creation — copy it immediately and store it securely.
        </p>
        <h4 className="text-sm font-semibold text-foreground">Using Your Key</h4>
        <p>
          Include the key in your HTTP requests using the <Code>X-Api-Key</Code> header:
        </p>
        <p className="bg-elevated rounded-md p-3 text-xs font-mono border border-border-subtle">
          X-Api-Key: your-api-key-here
        </p>
        <h4 className="text-sm font-semibold text-foreground">Revoking Keys</h4>
        <p>
          You can revoke any API key at any time from the API Keys settings tab. Revoked keys stop
          working immediately. Keys cannot be regenerated — create a new key if needed.
        </p>
      </div>
    ),
  },
  {
    id: 'public-api',
    icon: Globe,
    title: 'Public API',
    content: (
      <div className="space-y-3">
        <p>
          The Public API lets you fetch and render published prompts programmatically. All requests
          require an API key (see the <strong>API Keys</strong> section above).
        </p>

        <h4 className="text-sm font-semibold text-foreground">Authentication</h4>
        <p>
          Include your API key in every request using the <Code>X-Api-Key</Code> header. Keys use
          the format <Code>cl_...</Code>.
        </p>

        <h4 className="text-sm font-semibold text-foreground">Base URL</h4>
        <p className="bg-elevated rounded-md p-3 text-xs font-mono border border-border-subtle">
          /public/v1/entries
        </p>

        <h4 className="text-sm font-semibold text-foreground">
          GET /public/v1/entries/{'{entryId}'}
        </h4>
        <p>Fetch the published version of an entry, including its template field definitions.</p>
        <p className="bg-elevated rounded-md p-3 text-xs font-mono border border-border-subtle whitespace-pre">
          {`curl -H "X-Api-Key: cl_your_key_here" \\
  https://your-domain/public/v1/entries/{entryId}`}
        </p>
        <p className="text-xs text-foreground-muted mt-1">Response (200):</p>
        <pre className="bg-elevated rounded-md p-3 text-xs font-mono border border-border-subtle overflow-x-auto">
          {`{
  "id": "a1b2c3d4-...",
  "title": "Email Writer",
  "systemMessage": "You are a professional writer.",
  "version": 3,
  "prompts": [
    {
      "content": "Write a {{tone}} email to {{recipient}}.",
      "order": 0,
      "isTemplate": true,
      "templateFields": [
        {
          "name": "tone",
          "type": "enum",
          "enumValues": ["formal", "casual"],
          "defaultValue": null
        },
        {
          "name": "recipient",
          "type": "string",
          "defaultValue": null
        }
      ]
    }
  ]
}`}
        </pre>

        <h4 className="text-sm font-semibold text-foreground">
          POST /public/v1/entries/{'{entryId}'}/generate
        </h4>
        <p>
          Render a published entry by substituting template variables with the values you provide.
          All field values are passed as strings.
        </p>
        <p className="bg-elevated rounded-md p-3 text-xs font-mono border border-border-subtle whitespace-pre">
          {`curl -X POST \\
  -H "X-Api-Key: cl_your_key_here" \\
  -H "Content-Type: application/json" \\
  -d '{"fields":{"tone":"formal","recipient":"Jane"}}' \\
  https://your-domain/public/v1/entries/{entryId}/generate`}
        </p>
        <p className="text-xs text-foreground-muted mt-1">Response (200):</p>
        <pre className="bg-elevated rounded-md p-3 text-xs font-mono border border-border-subtle overflow-x-auto">
          {`{
  "id": "a1b2c3d4-...",
  "title": "Email Writer",
  "version": 3,
  "systemMessage": "You are a professional writer.",
  "renderedPrompts": [
    {
      "content": "Write a formal email to Jane.",
      "order": 0
    }
  ]
}`}
        </pre>

        <h4 className="text-sm font-semibold text-foreground">Template Field Types</h4>
        <div className="bg-elevated rounded-md border border-border-subtle overflow-hidden">
          <table className="w-full text-xs font-mono">
            <thead>
              <tr className="border-b border-border-subtle">
                <th className="text-left p-2 font-semibold text-foreground">Type</th>
                <th className="text-left p-2 font-semibold text-foreground">Validation</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border-subtle">
              <tr>
                <td className="p-2">string</td>
                <td className="p-2 font-sans">Must be non-empty</td>
              </tr>
              <tr>
                <td className="p-2">int</td>
                <td className="p-2 font-sans">Must be a valid integer; optional min/max range</td>
              </tr>
              <tr>
                <td className="p-2">float</td>
                <td className="p-2 font-sans">Must be a valid number; optional min/max range</td>
              </tr>
              <tr>
                <td className="p-2">enum</td>
                <td className="p-2 font-sans">
                  Must match one of the allowed values (case-insensitive)
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        <h4 className="text-sm font-semibold text-foreground">Error Responses</h4>
        <div className="bg-elevated rounded-md border border-border-subtle overflow-hidden">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-border-subtle">
                <th className="text-left p-2 font-semibold text-foreground">Status</th>
                <th className="text-left p-2 font-semibold text-foreground">Code</th>
                <th className="text-left p-2 font-semibold text-foreground">Meaning</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border-subtle">
              <tr>
                <td className="p-2 font-mono">401</td>
                <td className="p-2 font-mono">—</td>
                <td className="p-2">Missing or invalid API key</td>
              </tr>
              <tr>
                <td className="p-2 font-mono">404</td>
                <td className="p-2 font-mono">NOT_FOUND</td>
                <td className="p-2">Entry does not exist or is trashed</td>
              </tr>
              <tr>
                <td className="p-2 font-mono">404</td>
                <td className="p-2 font-mono">NOT_PUBLISHED</td>
                <td className="p-2">Entry exists but has no published version</td>
              </tr>
              <tr>
                <td className="p-2 font-mono">422</td>
                <td className="p-2 font-mono">VALIDATION_ERROR</td>
                <td className="p-2">Template field validation failed (generate only)</td>
              </tr>
              <tr>
                <td className="p-2 font-mono">429</td>
                <td className="p-2 font-mono">RATE_LIMITED</td>
                <td className="p-2">Too many requests (limit: 20/min per IP)</td>
              </tr>
            </tbody>
          </table>
        </div>
        <p className="text-xs text-foreground-muted">
          All errors return a JSON body:{' '}
          <Code>{'{{"error": {"code": "...", "message": "..."}}}'}</Code>. Validation errors include
          a <Code>details</Code> object with per-field messages.
        </p>
      </div>
    ),
  },
  {
    id: 'keyboard-shortcuts',
    icon: Keyboard,
    title: 'Keyboard Shortcuts',
    content: (
      <div className="space-y-3">
        <p>Use keyboard shortcuts to work faster in the entry editor.</p>
        <h4 className="text-sm font-semibold text-foreground">Editor Shortcuts</h4>
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span>Save draft</span>
            <span>
              <Kbd>Ctrl</Kbd> + <Kbd>S</Kbd>
            </span>
          </div>
          <div className="flex items-center justify-between">
            <span>Publish entry</span>
            <span>
              <Kbd>Ctrl</Kbd> + <Kbd>Enter</Kbd>
            </span>
          </div>
          <div className="flex items-center justify-between">
            <span>Undo</span>
            <span>
              <Kbd>Ctrl</Kbd> + <Kbd>Z</Kbd>
            </span>
          </div>
          <div className="flex items-center justify-between">
            <span>Redo</span>
            <span>
              <Kbd>Ctrl</Kbd> + <Kbd>Shift</Kbd> + <Kbd>Z</Kbd>
            </span>
          </div>
        </div>
        <h4 className="text-sm font-semibold text-foreground">Text Formatting</h4>
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span>Bold</span>
            <span>
              <Kbd>Ctrl</Kbd> + <Kbd>B</Kbd>
            </span>
          </div>
          <div className="flex items-center justify-between">
            <span>Italic</span>
            <span>
              <Kbd>Ctrl</Kbd> + <Kbd>I</Kbd>
            </span>
          </div>
          <div className="flex items-center justify-between">
            <span>Strikethrough</span>
            <span>
              <Kbd>Ctrl</Kbd> + <Kbd>Shift</Kbd> + <Kbd>X</Kbd>
            </span>
          </div>
          <div className="flex items-center justify-between">
            <span>Inline code</span>
            <span>
              <Kbd>Ctrl</Kbd> + <Kbd>E</Kbd>
            </span>
          </div>
        </div>
        <p className="text-xs text-foreground-muted">
          On macOS, use <Kbd>Cmd</Kbd> instead of <Kbd>Ctrl</Kbd>.
        </p>
      </div>
    ),
  },
  {
    id: 'trash',
    icon: FileText,
    title: 'Trash & Recovery',
    content: (
      <div className="space-y-3">
        <p>
          Deleted entries are moved to the trash and kept for <strong>30 days</strong> before
          permanent removal.
        </p>
        <h4 className="text-sm font-semibold text-foreground">Restoring Entries</h4>
        <p>
          Open the <strong>Trash</strong> page from the sidebar to see all deleted entries. Click
          the restore button on any entry to move it back to its original folder. You can also
          select multiple entries and restore them in bulk.
        </p>
        <h4 className="text-sm font-semibold text-foreground">Permanent Deletion</h4>
        <p>
          Only workspace admins can permanently delete entries from the trash. This action cannot be
          undone.
        </p>
      </div>
    ),
  },
  {
    id: 'account-settings',
    icon: Settings,
    title: 'Account & Settings',
    content: (
      <div className="space-y-3">
        <h4 className="text-sm font-semibold text-foreground">Profile</h4>
        <p>
          Update your display name, email address, and password from the{' '}
          <strong>Settings &gt; Profile</strong> tab. You can also upload a profile picture. If your
          account was created via Google sign-in, you can set a password to enable email-based login
          as well.
        </p>
        <h4 className="text-sm font-semibold text-foreground">Google Sign-In</h4>
        <p>
          You can sign in with your Google account from the login or registration page. This links
          your Google identity to your Clarive account.
        </p>
        <h4 className="text-sm font-semibold text-foreground">Sessions</h4>
        <p>
          View and manage your active login sessions. If you spot an unfamiliar session, you can
          revoke it to sign out that device immediately.
        </p>
        <h4 className="text-sm font-semibold text-foreground">Import & Export</h4>
        <p>
          Export all your entries as a backup or import entries from a file. This is useful for
          migrating data between workspaces or creating backups.
        </p>
        <h4 className="text-sm font-semibold text-foreground">Audit Log</h4>
        <p>
          Workspace admins can view the audit log to track changes made by team members, including
          entry edits, member invitations, and settings changes.
        </p>
        <h4 className="text-sm font-semibold text-foreground">Account Deletion</h4>
        <p>
          You can permanently delete your account from the Profile tab. This removes all your data
          and cannot be undone.
        </p>
      </div>
    ),
  },
];

export default function HelpPage() {
  useEffect(() => {
    document.title = 'Clarive — Help';
  }, []);

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <CircleHelp className="size-7 text-foreground-muted" />
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Help</h1>
          <p className="text-sm text-foreground-muted">Learn how to get the most out of Clarive.</p>
        </div>
      </div>

      <Accordion type="multiple" className="w-full">
        {sections.map((section) => (
          <AccordionItem key={section.id} value={section.id}>
            <AccordionTrigger className="hover:no-underline">
              <span className="flex items-center">
                <SectionIcon icon={section.icon} />
                {section.title}
              </span>
            </AccordionTrigger>
            <AccordionContent className="text-foreground-secondary">
              {section.content}
            </AccordionContent>
          </AccordionItem>
        ))}
      </Accordion>
    </div>
  );
}
