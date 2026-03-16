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
        <h4 className="text-sm font-semibold text-foreground">Your Dashboard</h4>
        <p>
          The dashboard shows your entry count, published prompts, recently edited entries, and a
          feed of workspace activity. It&apos;s a good place to pick up where you left off.
        </p>
        <h4 className="text-sm font-semibold text-foreground">Creating Your First Entry</h4>
        <ul className="list-disc list-inside space-y-1">
          <li>
            Click <strong>New Entry</strong> in the sidebar to start from scratch.
          </li>
          <li>
            Want AI to draft it for you? Click <strong>New Entry</strong>, then{' '}
            <strong>Use AI Wizard</strong>.
          </li>
          <li>
            Add a title, optionally set a system message, and write your prompt in the editor.
          </li>
          <li>
            Save as a draft or publish when it&apos;s ready. Publishing creates a versioned snapshot
            automatically.
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
          (instructions for the AI), and one or more <strong>prompt cards</strong> in the rich-text
          editor. Save, publish, and AI tools live in the action panel on the right.
        </p>
        <h4 className="text-sm font-semibold text-foreground">Prompt Chains</h4>
        <p>
          An entry can hold multiple prompts arranged as a chain. Click{' '}
          <strong>Add follow-up prompt</strong> to add a new card. Reorder with the up/down arrows
          or remove with the delete button on each card.
        </p>
        <h4 className="text-sm font-semibold text-foreground">Rich-Text Editing</h4>
        <p>
          The editor supports bold, italic, headings (H1–H3), bullet and numbered lists, inline
          code, and code blocks. Select text to open the <strong>bubble menu</strong> with
          formatting options, or use keyboard shortcuts.
        </p>
        <h4 className="text-sm font-semibold text-foreground">Entry States</h4>
        <ul className="list-disc list-inside space-y-1">
          <li>
            <strong>Draft</strong> — work in progress, visible to you and your team.
          </li>
          <li>
            <strong>Published</strong> — the current active version. Editing a published entry
            creates a new draft; the published version stays untouched until you publish again.
          </li>
          <li>
            <strong>Historical</strong> — a previous version, kept for reference. You can restore
            any historical version as a new draft.
          </li>
        </ul>
        <h4 className="text-sm font-semibold text-foreground">Versioning</h4>
        <p>
          Every publish creates a new version. Use the version history panel to browse past
          versions, compare any two side-by-side with a diff view, or restore a historical version
          as a new draft.
        </p>
        <h4 className="text-sm font-semibold text-foreground">AI Tools</h4>
        <ul className="list-disc list-inside space-y-1">
          <li>
            <strong>Enhance with AI</strong> — analyze and improve your current prompt.
          </li>
          <li>
            <strong>Generate System Message</strong> — create a system message from your prompt
            content (available when no system message is set).
          </li>
          <li>
            <strong>Decompose to Chain</strong> — split a single prompt into a multi-step chain
            (available for single-prompt entries).
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
        <p>The AI Wizard generates prompts from a description. It works in three steps:</p>
        <ol className="list-decimal list-inside space-y-2">
          <li>
            <strong>Describe</strong> — Tell the wizard what you need. The more specific you are
            about the task, audience, and desired output, the better the result. You can also
            configure:
            <ul className="list-disc list-inside ml-4 mt-1 space-y-1">
              <li>
                <strong>System message</strong> — sets the AI&apos;s role and behavior before the
                main prompt.
              </li>
              <li>
                <strong>Template variables</strong> — adds {'{{variable}}'} placeholders for dynamic
                content.
              </li>
              <li>
                <strong>Prompt chain</strong> — splits the output into multiple sequential prompts
                for complex tasks.
              </li>
              <li>
                <strong>Web research</strong> — searches the web for context to improve accuracy
                (requires Tavily configuration).
              </li>
            </ul>
          </li>
          <li>
            <strong>Review</strong> — See the generated prompt with quality scores across four
            dimensions: clarity, effectiveness, completeness, and faithfulness (each 0–10). The
            wizard may ask clarification questions to sharpen the result. Select enhancement
            suggestions and regenerate until you&apos;re satisfied.
          </li>
          <li>
            <strong>Save</strong> — Save the result as a new entry in your library.
          </li>
        </ol>
        <h4 className="text-sm font-semibold text-foreground">Enhancing Existing Entries</h4>
        <p>
          Open any entry in the editor and click <strong>Enhance with AI</strong>. The wizard
          analyzes your current prompt, shows quality scores, and lets you refine before saving the
          improvements back.
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
          Double curly braces define variables in your prompts — placeholders that get replaced with
          actual values at runtime. Clarive detects and highlights them in the editor automatically.
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
          When your prompt contains variables, a collapsible <strong>Template</strong> section
          appears below the editor. Fill in values and click <strong>Preview</strong> to see the
          rendered output.
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
        <p>Use the folder tree in the sidebar to organize your entries.</p>
        <h4 className="text-sm font-semibold text-foreground">Managing Folders</h4>
        <ul className="list-disc list-inside space-y-1">
          <li>
            Click <strong>New folder</strong> at the bottom of the folder tree to create a
            root-level folder.
          </li>
          <li>
            Hover over a folder and click the <strong>three-dot menu</strong> to add a subfolder,
            rename, or delete it.
          </li>
          <li>Nest folders as deep as you need.</li>
          <li>Click any folder to see its entries.</li>
        </ul>
        <h4 className="text-sm font-semibold text-foreground">Drag and Drop</h4>
        <p>
          Drag entries between folders in the library view. Drag folders to reorganize your
          structure. Drop onto a folder to move inside it — folders expand automatically when you
          hover during a drag.
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
          You can also be invited to <strong>shared workspaces</strong> for team collaboration. Each
          workspace has its own entries, folders, and settings.
        </p>
        <h4 className="text-sm font-semibold text-foreground">Switching Workspaces</h4>
        <p>
          Use the <strong>workspace switcher</strong> at the top of the sidebar. Your active
          workspace is marked with a checkmark.
        </p>
        <h4 className="text-sm font-semibold text-foreground">Inviting Members</h4>
        <p>
          Admins can invite members from <strong>Settings &gt; Users</strong>. Invitations go out by
          email and must be accepted before the user gains access. Admins can resend or revoke
          pending invitations.
        </p>
        <h4 className="text-sm font-semibold text-foreground">Accepting Invitations</h4>
        <p>
          When you receive an invitation, a badge appears on the bell icon in the sidebar. Click it
          to accept or decline.
        </p>
        <h4 className="text-sm font-semibold text-foreground">Roles</h4>
        <ul className="list-disc list-inside space-y-1">
          <li>
            <strong>Admin</strong> — full control: manage members, settings, and all entries.
          </li>
          <li>
            <strong>Editor</strong> — create, edit, and publish entries. Cannot manage members.
          </li>
          <li>
            <strong>Viewer</strong> — read-only access. Cannot create or modify content.
          </li>
        </ul>
        <h4 className="text-sm font-semibold text-foreground">Leaving a Workspace</h4>
        <p>
          Leave any shared workspace from <strong>Settings &gt; Users</strong>. Personal workspaces
          can&apos;t be left.
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
          Tool descriptions define external tools or functions that an AI model can call when
          running your prompts. Each one has a name, a tool identifier, and a description of what it
          does.
        </p>
        <h4 className="text-sm font-semibold text-foreground">Managing Tools</h4>
        <ul className="list-disc list-inside space-y-1">
          <li>
            Go to <strong>Settings → Tools</strong>.
          </li>
          <li>
            Click <strong>Add Tool</strong> to define a tool with a display name, identifier, and
            description.
          </li>
          <li>Edit a tool by clicking the pencil icon on its card.</li>
          <li>Delete with the trash icon (you&apos;ll be asked to confirm).</li>
        </ul>
        <h4 className="text-sm font-semibold text-foreground">MCP Import</h4>
        <p>
          You can import tool descriptions from an{' '}
          <strong>MCP (Model Context Protocol) server</strong>. Enter the server URL in the MCP
          Import section on the Tools page to discover and import available tools. If the server
          requires auth, provide a bearer token. Tools that already exist in your workspace are
          skipped.
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
          API keys let you access Clarive programmatically through the REST API. Only workspace
          admins can create and manage them.
        </p>
        <h4 className="text-sm font-semibold text-foreground">Creating a Key</h4>
        <p>
          Go to <strong>Settings &gt; API Keys</strong> and click <strong>Create API Key</strong>.
          Give it a name you&apos;ll recognize later. The full key is shown only once — copy it
          right away and store it somewhere safe.
        </p>
        <h4 className="text-sm font-semibold text-foreground">Using Your Key</h4>
        <p>
          Pass the key in the <Code>X-Api-Key</Code> header:
        </p>
        <p className="bg-elevated rounded-md p-3 text-xs font-mono border border-border-subtle">
          X-Api-Key: your-api-key-here
        </p>
        <h4 className="text-sm font-semibold text-foreground">Revoking Keys</h4>
        <p>
          Revoke any key from the API Keys settings tab. It stops working immediately. Keys
          can&apos;t be regenerated — create a new one instead.
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
          require an API key (see <strong>API Keys</strong> above).
        </p>

        <h4 className="text-sm font-semibold text-foreground">Authentication</h4>
        <p>
          Include your API key in every request via the <Code>X-Api-Key</Code> header. Keys use the
          format <Code>cl_...</Code>.
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
                <td className="p-2">Entry doesn&apos;t exist or is trashed</td>
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
        <h4 className="text-sm font-semibold text-foreground">Editor</h4>
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
          Deleted entries go to the trash and stay there for <strong>30 days</strong> before
          they&apos;re permanently removed.
        </p>
        <h4 className="text-sm font-semibold text-foreground">Restoring Entries</h4>
        <p>
          Open <strong>Trash</strong> from the sidebar to see deleted entries. Click restore on any
          entry to put it back in its original folder. Bulk restore is available too — select
          multiple entries and restore them at once.
        </p>
        <h4 className="text-sm font-semibold text-foreground">Permanent Deletion</h4>
        <p>Only admins can permanently delete entries from the trash. This can&apos;t be undone.</p>
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
          Update your display name, email, and password from <strong>Settings &gt; Profile</strong>.
          You can upload a profile picture here too. If you signed up with Google, you can set a
          password to enable email-based login as well.
        </p>
        <h4 className="text-sm font-semibold text-foreground">Google Sign-In</h4>
        <p>
          Sign in with Google from the login or registration page. This links your Google identity
          to your Clarive account.
        </p>
        <h4 className="text-sm font-semibold text-foreground">Sessions</h4>
        <p>
          View your active sessions. See something you don&apos;t recognize? Revoke it to sign out
          that device immediately.
        </p>
        <h4 className="text-sm font-semibold text-foreground">Import & Export</h4>
        <p>
          Export your entries as a backup or import from a file. Useful for migrating between
          workspaces or keeping local backups.
        </p>
        <h4 className="text-sm font-semibold text-foreground">Audit Log</h4>
        <p>
          Admins can view the audit log to see who did what — entry edits, member invitations,
          settings changes.
        </p>
        <h4 className="text-sm font-semibold text-foreground">Account Deletion</h4>
        <p>
          Permanently delete your account from the Profile tab. This removes all your data and
          can&apos;t be undone.
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
          <p className="text-sm text-foreground-muted">
            Everything you need to know about using Clarive.
          </p>
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
