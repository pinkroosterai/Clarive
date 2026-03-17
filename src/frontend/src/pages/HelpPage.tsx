import {
  CircleHelp,
  Rocket,
  FileText,
  Wand2,
  FlaskConical,
  Braces,
  Search,
  X,
  Star,
  FolderTree,
  ChevronsUpDown,
  Users,
  Wrench,
  Key,
  Keyboard,
  Settings,
  Globe,
  Share2,
} from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useLocation } from 'react-router-dom';

import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';

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

interface Section {
  id: string;
  icon: React.ElementType;
  title: string;
  searchText: string;
  content: React.ReactNode;
}

interface SectionGroup {
  label: string;
  sections: Section[];
}

const sectionGroups: SectionGroup[] = [
  {
    label: 'Core Features',
    sections: [
      {
        id: 'getting-started',
        icon: Rocket,
        title: 'Getting Started',
        searchText:
          'dashboard entry count published prompts recently edited activity new entry ai wizard title system message draft publish versioned snapshot guided tour onboarding',
        content: (
          <div className="space-y-3">
            <h4 className="text-sm font-semibold text-foreground">Your Dashboard</h4>
            <p>
              The dashboard shows your entry count, published prompts, recently edited entries, and
              a feed of workspace activity. It&apos;s a good place to pick up where you left off.
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
                Save as a draft or publish when it&apos;s ready. Publishing creates a versioned
                snapshot automatically.
              </li>
            </ul>
            <h4 className="text-sm font-semibold text-foreground">Guided Tour</h4>
            <p>
              New accounts see an interactive guided tour on first login that walks through the
              dashboard, sidebar navigation, entry editor, and key features. The tour highlights
              each area with step-by-step explanations so you can get oriented quickly.
            </p>
          </div>
        ),
      },
      {
        id: 'entry-editor',
        icon: FileText,
        title: 'Entry Editor',
        searchText:
          'title system message prompt cards rich-text editor sidebar tabs actions details versions prompt chains follow-up bold italic headings bubble menu draft published historical versioning diff restore delete draft ai enhance generate system message decompose chain test prompt playground',
        content: (
          <div className="space-y-3">
            <h4 className="text-sm font-semibold text-foreground">Editor Layout</h4>
            <p>
              Each entry has a <strong>title</strong>, an optional <strong>system message</strong>{' '}
              (instructions for the AI), and one or more <strong>prompt cards</strong> in the
              rich-text editor. The right sidebar is organized into three tabs:{' '}
              <strong>Actions</strong> (save, publish, AI tools), <strong>Details</strong> (tags,
              metadata, folder, activity), and <strong>Versions</strong> (history, diff, restore).
            </p>
            <h4 className="text-sm font-semibold text-foreground">Prompt Chains</h4>
            <p>
              An entry can hold multiple prompts arranged as a chain. Click{' '}
              <strong>Add follow-up prompt</strong> to add a new card. Reorder with the up/down
              arrows or remove with the delete button on each card.
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
                <strong>Historical</strong> — a previous version, kept for reference. You can
                restore any historical version as a new draft.
              </li>
            </ul>
            <h4 className="text-sm font-semibold text-foreground">Versioning</h4>
            <p>
              Every publish creates a new version. Open the <strong>Versions</strong> tab in the
              sidebar to browse past versions, compare any two side-by-side with a diff view, or
              restore a historical version as a new draft. You can also delete a draft to revert to
              the published version.
            </p>
            <h4 className="text-sm font-semibold text-foreground">AI Tools</h4>
            <ul className="list-disc list-inside space-y-1">
              <li>
                <strong>AI Enhance</strong> — analyze and improve your current prompt.
              </li>
              <li>
                <strong>Generate System Message</strong> — create a system message from your prompt
                content (available when no system message is set).
              </li>
              <li>
                <strong>Decompose to Chain</strong> — split a single prompt into a multi-step chain
                (available for single-prompt entries).
              </li>
              <li>
                <strong>Test Prompt</strong> — run your prompt in the playground to see the AI
                response.
              </li>
            </ul>
          </div>
        ),
      },
      {
        id: 'ai-wizard',
        icon: Wand2,
        title: 'AI Wizard',
        searchText:
          'ai wizard generate prompts description system message template variables prompt chain web research review quality scores clarity effectiveness completeness faithfulness clarification enhancement save enhance existing entries',
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
                    <strong>System message</strong> — sets the AI&apos;s role and behavior before
                    the main prompt.
                  </li>
                  <li>
                    <strong>Template variables</strong> — adds {'{{variable}}'} placeholders for
                    dynamic content.
                  </li>
                  <li>
                    <strong>Prompt chain</strong> — splits the output into multiple sequential
                    prompts for complex tasks.
                  </li>
                  <li>
                    <strong>Web research</strong> — searches the web for context to improve
                    accuracy.
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
              Open any entry in the editor and click <strong>AI Enhance</strong>. The wizard
              analyzes your current prompt, shows quality scores, and lets you refine before saving
              the improvements back.
            </p>
          </div>
        ),
      },
      {
        id: 'playground',
        icon: FlaskConical,
        title: 'Playground',
        searchText:
          'playground test prompt model temperature max tokens reasoning effort show thinking run stop streaming token count history comparison pin rerun copy response chain step ctrl enter escape',
        content: (
          <div className="space-y-3">
            <h4 className="text-sm font-semibold text-foreground">Testing Your Prompts</h4>
            <p>
              The Playground lets you run any published entry against a live AI model and see the
              response in real time. Open it from the <strong>Test Prompt</strong> button in the
              editor&apos;s Actions tab, or navigate directly to an entry&apos;s test page.
            </p>
            <h4 className="text-sm font-semibold text-foreground">Toolbar Controls</h4>
            <ul className="list-disc list-inside space-y-1">
              <li>
                <strong>Model</strong> — pick from available models, grouped by provider. Selecting
                a model auto-fills its default temperature, max tokens, and reasoning settings.
              </li>
              <li>
                <strong>Temperature</strong> — controls randomness (0 = deterministic, 2 = very
                creative). Adjustable in 0.1 increments. Hidden for reasoning models.
              </li>
              <li>
                <strong>Max Tokens</strong> — limits the response length. Defaults come from the
                model configuration.
              </li>
              <li>
                <strong>Reasoning Effort</strong> — appears for reasoning models. Choose Low,
                Medium, High, or Extra High.
              </li>
              <li>
                <strong>Show Thinking</strong> — toggle to display the model&apos;s reasoning
                process alongside the final response.
              </li>
            </ul>
            <h4 className="text-sm font-semibold text-foreground">Running a Test</h4>
            <p>
              Click the <strong>Run</strong> button (or press <Kbd>Ctrl</Kbd> + <Kbd>Enter</Kbd>) to
              start. The response streams in token by token with a live elapsed-time counter and
              token estimate. For prompt chains, numbered step indicators show progress through each
              prompt. Press <Kbd>Esc</Kbd> or click <strong>Stop</strong> to abort mid-stream.
            </p>
            <p>
              If the entry has template variables, a form appears to fill in values before running.
              Variable values persist across reruns so you can iterate without re-entering them.
            </p>
            <h4 className="text-sm font-semibold text-foreground">History & Comparison</h4>
            <p>
              Toggle the history sidebar to see past test runs with their model, temperature, and
              timestamp. Expand any run to read its full response. Use the <strong>pin</strong>{' '}
              button to keep a run visible for side-by-side comparison with the current result, or{' '}
              <strong>rerun</strong> to load that run&apos;s parameters and execute again
              immediately. Hover over any response to copy it.
            </p>
          </div>
        ),
      },
    ],
  },
  {
    label: 'Content & Organization',
    sections: [
      {
        id: 'templates',
        icon: Braces,
        title: 'Templates & Variables',
        searchText:
          'template variables curly braces placeholder type string int float enum constraints default value description popover insert variable syntax form preview rendered output',
        content: (
          <div className="space-y-3">
            <h4 className="text-sm font-semibold text-foreground">What Are Template Variables?</h4>
            <p>
              Variables turn prompts into reusable templates. Wrap any word in double curly braces —{' '}
              <Code>{'{{topic}}'}</Code> — and it becomes a placeholder that gets filled in before
              the prompt runs. Clarive highlights variables in the editor so they stand out.
            </p>

            <h4 className="text-sm font-semibold text-foreground">Adding & Editing Variables</h4>
            <p>
              You can type variables directly, or click the <strong>{'{ }'} button</strong> in the
              top-right corner of any prompt card to insert one. Either way,{' '}
              <strong>click any highlighted variable</strong> to open a popover where you can set
              its name, type, constraints, default value, and description — no syntax to memorize.
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
                    <td className="p-2 font-sans">Integer with min/max range</td>
                  </tr>
                  <tr>
                    <td className="p-2">float</td>
                    <td className="p-2">{'{{temp|float:0-1.5}}'}</td>
                    <td className="p-2 font-sans">Decimal with min/max range</td>
                  </tr>
                  <tr>
                    <td className="p-2">enum</td>
                    <td className="p-2">{'{{tone|enum:formal,casual}}'}</td>
                    <td className="p-2 font-sans">Dropdown with fixed options</td>
                  </tr>
                </tbody>
              </table>
            </div>

            <h4 className="text-sm font-semibold text-foreground">Defaults & Descriptions</h4>
            <p>
              Variables can carry a default value and a description for whoever fills in the
              template. Add them after the constraints, separated by colons:
            </p>
            <p className="bg-elevated rounded-md p-3 text-xs font-mono border border-border-subtle">
              {'{{tone|enum:formal,casual:formal:The writing style}}'}
            </p>
            <p>
              The default pre-fills the form field. The description shows as a hint underneath it.
              Both are optional — skip them and the variable works the same as before.
            </p>

            <h4 className="text-sm font-semibold text-foreground">Full Syntax</h4>
            <p className="bg-elevated rounded-md p-3 text-xs font-mono border border-border-subtle">
              {'{{name|type:constraints:default:description}}'}
            </p>
            <p className="text-xs text-foreground-muted">
              Everything after the name is optional. Variable names can contain letters, digits, and
              underscores. If a name appears in multiple prompts, the first occurrence sets the
              type.
            </p>

            <h4 className="text-sm font-semibold text-foreground">Template Form</h4>
            <p>
              When your prompt contains variables, a <strong>Template Variables</strong> section
              appears below the editor with a form field for each one. Default values are
              pre-filled, descriptions show as hints, and you can click <strong>Preview</strong> to
              see the rendered output with your values substituted in.
            </p>
          </div>
        ),
      },
      {
        id: 'library',
        icon: Search,
        title: 'Library & Search',
        searchText:
          'library browse grid search filter status draft published sort recent alphabetical oldest tags any all pagination 50 entries per page',
        content: (
          <div className="space-y-3">
            <h4 className="text-sm font-semibold text-foreground">Browsing Your Library</h4>
            <p>
              The library shows all entries in your workspace as a responsive grid — one column on
              mobile, two on tablet, three on desktop. Click any entry card to open it in the
              editor.
            </p>
            <h4 className="text-sm font-semibold text-foreground">Searching</h4>
            <p>
              Type in the search bar to filter entries by title. Results update as you type with a
              short delay. The result count shows inline when filters are active.
            </p>
            <h4 className="text-sm font-semibold text-foreground">Filtering & Sorting</h4>
            <ul className="list-disc list-inside space-y-1">
              <li>
                <strong>Status</strong> — filter by All, Draft, or Published.
              </li>
              <li>
                <strong>Sort</strong> — order by Recent (default), Alphabetical, or Oldest.
              </li>
              <li>
                <strong>Tags</strong> — select one or more tags to filter. When two or more tags are
                selected, a toggle appears to switch between <strong>Any</strong> (entries matching
                at least one tag) and <strong>All</strong> (entries matching every selected tag).
              </li>
            </ul>
            <h4 className="text-sm font-semibold text-foreground">Pagination</h4>
            <p>
              The library shows 50 entries per page. Use the Previous/Next buttons at the bottom to
              navigate. Changing any filter resets you to the first page.
            </p>
          </div>
        ),
      },
      {
        id: 'favorites',
        icon: Star,
        title: 'Favorites',
        searchText: 'star favorite entry card dashboard timestamp unstar',
        content: (
          <div className="space-y-3">
            <h4 className="text-sm font-semibold text-foreground">Starring Entries</h4>
            <p>
              Click the <strong>star icon</strong> on any entry card in the library to mark it as a
              favorite. Click again to remove it. Starred entries appear in the{' '}
              <strong>Favorites</strong> section on your dashboard for quick access, along with a
              timestamp showing when you favorited them.
            </p>
            <h4 className="text-sm font-semibold text-foreground">Where Favorites Appear</h4>
            <p>
              The dashboard shows a dedicated Favorites panel when you have starred entries. Each
              favorite is a clickable link that opens the entry directly. You can also unstar
              entries from the dashboard by clicking the star icon there.
            </p>
          </div>
        ),
      },
      {
        id: 'folders',
        icon: FolderTree,
        title: 'Folders & Organization',
        searchText:
          'folder tree sidebar new folder subfolder rename delete nest drag drop entries reorganize',
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
                Hover over a folder and click the <strong>three-dot menu</strong> to add a
                subfolder, rename, or delete it.
              </li>
              <li>Nest folders as deep as you need.</li>
              <li>Click any folder to see its entries.</li>
            </ul>
            <h4 className="text-sm font-semibold text-foreground">Drag and Drop</h4>
            <p>
              Drag entries between folders in the library view. Drag folders to reorganize your
              structure. Drop onto a folder to move inside it — folders expand automatically when
              you hover during a drag.
            </p>
          </div>
        ),
      },
      {
        id: 'share-links',
        icon: Share2,
        title: 'Share Links',
        searchText:
          'share link public read-only access password protect expiration copy revoke regenerate manage share link viewer token',
        content: (
          <div className="space-y-3">
            <p>
              Share a read-only view of any published prompt with anyone — no account required. Open
              an entry and click <strong>Share Link</strong> in the Actions sidebar to create one.
            </p>
            <h4 className="text-sm font-semibold text-foreground">Creating a Share Link</h4>
            <ul className="list-disc list-inside space-y-1">
              <li>
                Optionally set an <strong>expiration date</strong> so the link stops working
                automatically.
              </li>
              <li>
                Optionally add a <strong>password</strong> (minimum 8 characters). Visitors will
                need to enter it before viewing.
              </li>
              <li>
                Click <strong>Create Share Link</strong> to generate the URL. Copy it and share with
                anyone.
              </li>
            </ul>
            <h4 className="text-sm font-semibold text-foreground">Managing an Existing Link</h4>
            <p>
              Once a link is active, the button changes to <strong>Manage Share Link</strong>. From
              there you can:
            </p>
            <ul className="list-disc list-inside space-y-1">
              <li>
                <strong>Copy Link</strong> — copy the existing URL to share again without
                invalidating it.
              </li>
              <li>
                <strong>Regenerate</strong> — create a new URL. The old link stops working
                immediately.
              </li>
              <li>
                <strong>Revoke</strong> — permanently remove the share link. The public page will
                show &quot;Link Not Found.&quot;
              </li>
            </ul>
            <h4 className="text-sm font-semibold text-foreground">What Visitors See</h4>
            <p>
              Visitors see a clean, read-only page with the prompt title, version number, system
              message (if any), and all prompt content. They can copy everything to their clipboard
              with one click. Template variables are shown as metadata but not editable.
            </p>
          </div>
        ),
      },
    ],
  },
  {
    label: 'Team & Workspace',
    sections: [
      {
        id: 'workspaces',
        icon: Users,
        title: 'Workspaces & Teams',
        searchText:
          'personal shared workspace team collaboration workspace switcher invite members email admin editor viewer roles leave revoke invitation bell notification',
        content: (
          <div className="space-y-3">
            <h4 className="text-sm font-semibold text-foreground">Personal vs Shared Workspaces</h4>
            <p>
              Every account starts with a <strong>personal workspace</strong> that only you can
              access. You can also be invited to <strong>shared workspaces</strong> for team
              collaboration. Each workspace has its own entries, folders, and settings.
            </p>
            <h4 className="text-sm font-semibold text-foreground">Switching Workspaces</h4>
            <p>
              Use the <strong>workspace switcher</strong> at the top of the sidebar. Your active
              workspace is marked with a checkmark.
            </p>
            <h4 className="text-sm font-semibold text-foreground">Inviting Members</h4>
            <p>
              Admins can invite members from <strong>Settings &gt; Users</strong>. Invitations go
              out by email and must be accepted before the user gains access. Admins can resend or
              revoke pending invitations.
            </p>
            <h4 className="text-sm font-semibold text-foreground">Accepting Invitations</h4>
            <p>
              When you receive an invitation, a badge appears on the bell icon in the sidebar. Click
              it to accept or decline.
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
              Leave any shared workspace from <strong>Settings &gt; Users</strong>. Personal
              workspaces can&apos;t be left.
            </p>
          </div>
        ),
      },
      {
        id: 'tools',
        icon: Wrench,
        title: 'Tools & MCP',
        searchText:
          'tool descriptions external functions ai model name identifier add tool edit delete mcp model context protocol server import bearer token',
        content: (
          <div className="space-y-3">
            <h4 className="text-sm font-semibold text-foreground">What Are Tool Descriptions?</h4>
            <p>
              Tool descriptions define external tools or functions that an AI model can call when
              running your prompts. Each one has a name, a tool identifier, and a description of
              what it does.
            </p>
            <h4 className="text-sm font-semibold text-foreground">Managing Tools</h4>
            <ul className="list-disc list-inside space-y-1">
              <li>
                Go to <strong>Settings → Tools</strong>.
              </li>
              <li>
                Click <strong>Add Tool</strong> to define a tool with a display name, identifier,
                and description.
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
    ],
  },
  {
    label: 'Reference',
    sections: [
      {
        id: 'api-keys',
        icon: Key,
        title: 'API Keys',
        searchText:
          'api key programmatic rest api admin create copy store x-api-key header revoke regenerate cl_',
        content: (
          <div className="space-y-3">
            <p>
              API keys let you access Clarive programmatically through the REST API. Only workspace
              admins can create and manage them.
            </p>
            <h4 className="text-sm font-semibold text-foreground">Creating a Key</h4>
            <p>
              Go to <strong>Settings &gt; API Keys</strong> and click{' '}
              <strong>Create API Key</strong>. Give it a name you&apos;ll recognize later. The full
              key is shown only once — copy it right away and store it somewhere safe.
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
        searchText:
          'public api fetch render published prompts get post entries generate template fields validation authentication x-api-key curl json error 401 404 422 429 rate limit',
        content: (
          <div className="space-y-3">
            <p>
              The Public API lets you fetch and render published prompts programmatically. All
              requests require an API key (see <strong>API Keys</strong> above).
            </p>

            <h4 className="text-sm font-semibold text-foreground">Authentication</h4>
            <p>
              Include your API key in every request via the <Code>X-Api-Key</Code> header. Keys use
              the format <Code>cl_...</Code>.
            </p>

            <h4 className="text-sm font-semibold text-foreground">Base URL</h4>
            <p className="bg-elevated rounded-md p-3 text-xs font-mono border border-border-subtle">
              /public/v1/entries
            </p>

            <h4 className="text-sm font-semibold text-foreground">
              GET /public/v1/entries/{'{entryId}'}
            </h4>
            <p>
              Fetch the published version of an entry, including its template field definitions.
            </p>
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
              Render a published entry by substituting template variables with the values you
              provide. All field values are passed as strings.
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
                    <td className="p-2 font-sans">
                      Must be a valid integer; optional min/max range
                    </td>
                  </tr>
                  <tr>
                    <td className="p-2">float</td>
                    <td className="p-2 font-sans">
                      Must be a valid number; optional min/max range
                    </td>
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
              <Code>{'{{"error": {"code": "...", "message": "..."}}}'}</Code>. Validation errors
              include a <Code>details</Code> object with per-field messages.
            </p>
          </div>
        ),
      },
      {
        id: 'keyboard-shortcuts',
        icon: Keyboard,
        title: 'Keyboard Shortcuts',
        searchText:
          'keyboard shortcuts save draft ctrl s publish enter undo redo bold italic strikethrough inline code cmd mac',
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
        searchText:
          'trash delete 30 days permanently removed restore original folder bulk restore admin permanent deletion',
        content: (
          <div className="space-y-3">
            <p>
              Deleted entries go to the trash and stay there for <strong>30 days</strong> before
              they&apos;re permanently removed.
            </p>
            <h4 className="text-sm font-semibold text-foreground">Restoring Entries</h4>
            <p>
              Open <strong>Trash</strong> from the sidebar to see deleted entries. Click restore on
              any entry to put it back in its original folder. Bulk restore is available too —
              select multiple entries and restore them at once.
            </p>
            <h4 className="text-sm font-semibold text-foreground">Permanent Deletion</h4>
            <p>
              Only admins can permanently delete entries from the trash. This can&apos;t be undone.
            </p>
          </div>
        ),
      },
      {
        id: 'account-settings',
        icon: Settings,
        title: 'Account & Settings',
        searchText:
          'profile display name email password avatar google sign-in sessions browser os ip address revoke import export yaml backup audit log events created updated published trashed restored deleted 30 days appearance theme light dark system account deletion',
        content: (
          <div className="space-y-3">
            <h4 className="text-sm font-semibold text-foreground">Profile</h4>
            <p>
              Update your display name, email, and password from{' '}
              <strong>Settings &gt; Profile</strong>. You can upload a profile picture here too. If
              you signed up with Google, you can set a password to enable email-based login as well.
            </p>
            <h4 className="text-sm font-semibold text-foreground">Google Sign-In</h4>
            <p>
              Sign in with Google from the login or registration page. This links your Google
              identity to your Clarive account.
            </p>
            <h4 className="text-sm font-semibold text-foreground">Sessions</h4>
            <p>
              View all active sessions under <strong>Settings &gt; Profile</strong>. Each session
              shows the browser name, operating system, IP address, and when it was created. Your
              current session is marked with a green <strong>Current</strong> badge and cannot be
              revoked.
            </p>
            <ul className="list-disc list-inside space-y-1">
              <li>
                Click the <strong>trash icon</strong> on any other session to revoke it
                individually.
              </li>
              <li>
                Use <strong>Revoke All Others</strong> to sign out every session except the one
                you&apos;re using right now.
              </li>
            </ul>
            <h4 className="text-sm font-semibold text-foreground">Import & Export</h4>
            <p>Back up your work or migrate entries between workspaces using YAML files.</p>
            <ul className="list-disc list-inside space-y-1">
              <li>
                <strong>Export All Entries</strong> — downloads every entry in the workspace as a
                single <Code>.yaml</Code> file named <Code>clarive-export-YYYY-MM-DD.yaml</Code>.
              </li>
              <li>
                <strong>Export Folder</strong> — opens a folder picker so you can export just one
                folder&apos;s entries.
              </li>
              <li>
                <strong>Import</strong> — drag and drop a <Code>.yaml</Code> or <Code>.yml</Code>{' '}
                file, or click to browse. Imported entries are created as <strong>drafts</strong> in
                the workspace root. The file name and size are shown before you confirm.
              </li>
            </ul>
            <h4 className="text-sm font-semibold text-foreground">Audit Log</h4>
            <p>
              Admins can view a timeline of workspace activity. Each entry shows the timestamp,
              user, action, entity, and optional details. Logs are retained for{' '}
              <strong>30 days</strong> and paginated at 20 entries per page.
            </p>
            <div className="bg-elevated rounded-md border border-border-subtle overflow-hidden">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-border-subtle">
                    <th className="text-left p-2 font-semibold text-foreground">Event</th>
                    <th className="text-left p-2 font-semibold text-foreground">Meaning</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border-subtle">
                  <tr>
                    <td className="p-2 font-mono">entry_created</td>
                    <td className="p-2">A new entry was created</td>
                  </tr>
                  <tr>
                    <td className="p-2 font-mono">entry_updated</td>
                    <td className="p-2">An entry was edited</td>
                  </tr>
                  <tr>
                    <td className="p-2 font-mono">entry_published</td>
                    <td className="p-2">An entry was published</td>
                  </tr>
                  <tr>
                    <td className="p-2 font-mono">entry_trashed</td>
                    <td className="p-2">An entry was moved to trash</td>
                  </tr>
                  <tr>
                    <td className="p-2 font-mono">entry_restored</td>
                    <td className="p-2">An entry was restored from trash</td>
                  </tr>
                  <tr>
                    <td className="p-2 font-mono">entry_deleted</td>
                    <td className="p-2">An entry was permanently deleted</td>
                  </tr>
                </tbody>
              </table>
            </div>
            <h4 className="text-sm font-semibold text-foreground">Appearance</h4>
            <p>
              Click the theme icon in the top-right corner of the page to cycle between{' '}
              <strong>Light</strong> (sun icon), <strong>Dark</strong> (moon icon), and{' '}
              <strong>System</strong> (monitor icon) modes. System mode follows your operating
              system&apos;s preference. Your choice is saved automatically.
            </p>
            <h4 className="text-sm font-semibold text-foreground">Account Deletion</h4>
            <p>
              Permanently delete your account from the Profile tab. This removes all your data and
              can&apos;t be undone.
            </p>
          </div>
        ),
      },
    ],
  },
];

const allSections = sectionGroups.flatMap((g) => g.sections);

export default function HelpPage() {
  const location = useLocation();
  const [openSections, setOpenSections] = useState<string[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeSection, setActiveSection] = useState<string | null>(null);
  const observerRef = useRef<IntersectionObserver | null>(null);

  useEffect(() => {
    document.title = 'Clarive — Help';
  }, []);

  // Hash navigation
  useEffect(() => {
    const hash = location.hash.replace('#', '');
    if (hash && allSections.some((s) => s.id === hash)) {
      setOpenSections((prev) => (prev.includes(hash) ? prev : [...prev, hash]));
      setTimeout(() => {
        document.getElementById(hash)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }, 150);
    }
  }, [location.hash]);

  // Filter groups by search query
  const filteredGroups = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();
    if (!q) return sectionGroups;
    return sectionGroups
      .map((group) => ({
        ...group,
        sections: group.sections.filter(
          (s) => s.title.toLowerCase().includes(q) || s.searchText.toLowerCase().includes(q)
        ),
      }))
      .filter((group) => group.sections.length > 0);
  }, [searchQuery]);

  const visibleSectionIds = useMemo(
    () => filteredGroups.flatMap((g) => g.sections.map((s) => s.id)),
    [filteredGroups]
  );

  // IntersectionObserver for active section highlighting
  useEffect(() => {
    observerRef.current?.disconnect();

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            setActiveSection(entry.target.id);
          }
        }
      },
      { threshold: 0.1, rootMargin: '-80px 0px -60% 0px' }
    );
    observerRef.current = observer;

    for (const id of visibleSectionIds) {
      const el = document.getElementById(id);
      if (el) observer.observe(el);
    }

    return () => observer.disconnect();
  }, [visibleSectionIds]);

  const handleTocClick = useCallback((sectionId: string) => {
    setOpenSections((prev) => (prev.includes(sectionId) ? prev : [...prev, sectionId]));
    setTimeout(() => {
      document.getElementById(sectionId)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 150);
  }, []);

  return (
    <div className="flex gap-8 max-w-6xl mx-auto p-6">
      {/* Main content */}
      <div className="flex-1 min-w-0 space-y-6">
        <div className="flex items-center gap-3">
          <CircleHelp className="size-7 text-foreground-muted" />
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Help</h1>
            <p className="text-sm text-foreground-muted">
              Everything you need to know about using Clarive.
            </p>
          </div>
        </div>

        {/* Search + Expand/Collapse */}
        <div className="flex items-center gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-foreground-muted" />
            <Input
              placeholder="Search help..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9 pr-8"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-foreground-muted hover:text-foreground"
              >
                <X className="size-4" />
              </button>
            )}
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setOpenSections(visibleSectionIds)}
            className="shrink-0 text-xs"
          >
            <ChevronsUpDown className="size-3.5 mr-1" />
            Expand All
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setOpenSections([])}
            className="shrink-0 text-xs"
          >
            Collapse All
          </Button>
        </div>

        {/* Accordion with grouped sections */}
        {filteredGroups.length === 0 ? (
          <div className="text-center py-12 text-foreground-muted">
            <Search className="size-8 mx-auto mb-3 opacity-40" />
            <p className="text-sm">No results for &ldquo;{searchQuery}&rdquo;</p>
          </div>
        ) : (
          <Accordion
            type="multiple"
            value={openSections}
            onValueChange={setOpenSections}
            className="w-full"
          >
            {filteredGroups.map((group) => (
              <div key={group.label}>
                <p className="text-xs font-semibold text-foreground-muted uppercase tracking-wider pt-4 pb-1">
                  {group.label}
                </p>
                {group.sections.map((section) => (
                  <AccordionItem key={section.id} value={section.id} id={section.id}>
                    <AccordionTrigger className="hover:no-underline">
                      <span className="flex items-center">
                        <SectionIcon icon={section.icon} />
                        {section.title}
                      </span>
                    </AccordionTrigger>
                    <AccordionContent className="text-foreground-muted">
                      {section.content}
                    </AccordionContent>
                  </AccordionItem>
                ))}
              </div>
            ))}
          </Accordion>
        )}
      </div>

      {/* Sidebar TOC — desktop only, right side */}
      <nav className="hidden lg:block w-56 shrink-0">
        <div className="sticky top-20 space-y-3">
          {filteredGroups.map((group) => (
            <div key={group.label}>
              <p className="text-xs font-semibold text-foreground-muted uppercase tracking-wider pb-1">
                {group.label}
              </p>
              <div className="space-y-0.5">
                {group.sections.map((section) => (
                  <button
                    key={section.id}
                    type="button"
                    onClick={() => handleTocClick(section.id)}
                    className={cn(
                      'flex items-center gap-2 text-sm w-full text-left py-1 px-2 rounded-md transition-colors',
                      activeSection === section.id
                        ? 'text-foreground font-medium bg-primary/5 border-l-2 border-primary'
                        : 'text-foreground-muted hover:text-foreground hover:bg-elevated'
                    )}
                  >
                    <section.icon className="size-3.5 shrink-0" />
                    <span className="truncate">{section.title}</span>
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      </nav>
    </div>
  );
}
